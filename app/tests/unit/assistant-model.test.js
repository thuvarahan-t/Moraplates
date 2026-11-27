import test from 'node:test'
import assert from 'node:assert/strict'
import { askAssistantModel, greetAssistant } from '../../server/assistant-model.js'

const catalog = {
  canteens: [
    { id: 'it', name: 'IT Canteen', openNow: true, opensAt: '07:00', closesAt: '19:00', location: 'IT Faculty' },
    { id: 'wus', name: 'WUS Canteen', openNow: false, opensAt: '08:00', closesAt: '17:30', location: 'Student Centre' },
  ],
  foods: [
    { id: 'db-rice-id', canteenId: 'it', name: 'Rice', priceLkr: 240, totalRatings: 12, superCount: 10 },
    { id: 'db-roll-id', canteenId: 'wus', name: 'Rolls', priceLkr: 80, totalRatings: 1, superCount: 1 },
  ],
}

const reply = plan => Response.json({
  status: 'completed',
  steps: [
    { type: 'thought', content: [{ type: 'text', text: 'Private thought' }] },
    { type: 'model_output', content: [{ type: 'text', text: JSON.stringify(plan) }] },
  ],
})
const plan = fields => ({ intent: 'menu', language: 'en', preference: 'keep', ...fields })
const ask = (question, fields, options = {}) => askAssistantModel({
  apiKey: 'test-secret', question, catalog, fetchImpl: () => reply(plan(fields)), ...options,
})

test('sends labels and short references to Gemini, then renders verified catalog facts', async () => {
  const result = await ask('Is teh IT Canteen still open?', {}, { fetchImpl: (url, request) => {
    const body = JSON.parse(request.body)
    const input = JSON.parse(body.input)
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/interactions')
    assert.equal(request.headers['x-goog-api-key'], 'test-secret')
    assert.equal(request.redirect, 'error')
    assert.equal(body.store, false)
    assert.equal(input.question, 'Is teh IT Canteen still open?')
    assert.equal(input.catalog.canteens[0].id, 'canteen-1')
    assert.deepEqual(input.catalog.foods[0], { id: 'food-1', canteenId: 'canteen-1', name: 'Rice' })
    assert.doesNotMatch(body.input, /db-rice-id|priceLkr|openNow|totalRatings/)
    return reply(plan({ intent: 'open', canteenIds: ['canteen-1'], answer: 'The canteen is closed.' }))
  } })
  assert.equal(result.status, 'answer')
  assert.match(result.answer, /IT Canteen.*open/i)
  assert.doesNotMatch(result.answer, /closed/)
  assert.deepEqual(result.context.focus.canteenIds, ['it'])
})

test('keeps an explicit preference across turns and resets when the user switches back to automatic', async () => {
  const tamil = await ask('Use Tamil for your replies', { intent: 'language', preference: 'ta' })
  assert.equal(tamil.language, 'ta')
  assert.equal(tamil.context.languagePreference, 'ta')
  assert.match(tamil.answer, /\p{Script=Tamil}/u)

  const price = await ask('What about the rolls?', { intent: 'price', foodIds: ['food-2'] }, { context: tamil.context })
  assert.equal(price.language, 'ta')
  assert.match(price.answer, /Rolls.*ரூ\. 80/)
  assert.deepEqual(price.context.focus.foodIds, ['db-roll-id'])

  const sinhala = await ask('සිංහලෙන් කියන්න', { intent: 'language', preference: 'si', language: 'si' }, { context: price.context })
  assert.equal(sinhala.language, 'si')
  assert.deepEqual(sinhala.context.focus, price.context.focus)

  const roman = await ask('Sinhala in English letters please', { intent: 'language', preference: 'singlish' }, { context: sinhala.context })
  assert.equal(roman.language, 'singlish')
  assert.equal(roman.context.languagePreference, 'singlish')
  assert.doesNotMatch(roman.answer, /\p{Script=Sinhala}/u)

  const auto = await ask('Match my question language again', { intent: 'language', preference: 'auto' }, { context: roman.context })
  assert.equal(auto.language, 'en')
  assert.equal(auto.context.languagePreference, null)
  assert.deepEqual(auto.context.focus, price.context.focus)
})

test('preserves stable dish identity through catalog reorder and reads a fresh price on a short follow-up', async () => {
  const initial = await ask('Which canteen has rolls?', { intent: 'menu', foodIds: ['food-2'] })
  const fresh = { ...catalog, foods: [{ ...catalog.foods[1], priceLkr: 95 }, catalog.foods[0]] }
  const result = await ask('mila kochcharada?', {}, { context: initial.context, catalog: fresh, fetchImpl: (_url, request) => {
    const input = JSON.parse(JSON.parse(request.body).input)
    assert.deepEqual(input.context.focus.foodIds, ['food-1'])
    assert.equal(input.catalog.foods[0].name, 'Rolls')
    return reply(plan({ intent: 'price', language: 'singlish', foodIds: ['food-1'] }))
  } })
  assert.equal(result.language, 'singlish')
  assert.match(result.answer, /WUS Canteen eke Rolls.*95/)
  assert.doesNotMatch(result.answer, /80/)
})

test('a correction replaces earlier filters and an unresolved named item never broadens the query', async () => {
  const initial = await ask('IT canteen la 300 kulla enna?', { intent: 'menu', language: 'tanglish', canteenIds: ['canteen-1'], maxPriceLkr: 300 })
  const corrected = await ask('Actually WUS, under 100', { intent: 'menu', canteenIds: ['canteen-2'], maxPriceLkr: 100, exclusive: true }, { context: initial.context })
  assert.match(corrected.answer, /WUS Canteen.*80/)
  assert.doesNotMatch(corrected.answer, /Rice/)
  assert.equal(corrected.context.focus.maxPriceLkr, 100)
  const invalid = await ask('How much is the mystery plate?', { intent: 'price', foodIds: ['food-99'] }, { context: corrected.context })
  assert.equal(invalid.status, 'no_data')
  assert.doesNotMatch(invalid.answer, /Rolls|Rice|240/)
})

test('clear mixed Tanglish grammar wins over an incorrect Roman-language tag', async () => {
  const result = await ask('actually atha vida kammi, 150 kulla', {
    intent: 'menu', language: 'singlish', canteenIds: ['canteen-1'], maxPriceLkr: 150,
  })
  assert.equal(result.language, 'tanglish')
  assert.equal(result.context.focus.maxPriceLkr, 150)
})

test('asks for the canteen when an unanchored reference would broaden opening hours to every canteen', async () => {
  const result = await ask('When does that canteen close?', { intent: 'hours' })
  assert.equal(result.status, 'clarify')
  assert.equal(result.answer, 'Which canteen do you mean?')
  assert.equal(result.context.focus, null)
})

test('a relevant clarification keeps the focus and leaves the full exchange available for the next turn', async () => {
  const initial = await ask('Rice price?', { intent: 'price', foodIds: ['food-1'] })
  const history = [{ question: 'What about the other place?', answer: 'Which canteen do you mean?' }]
  const result = await ask('That one across the road', { intent: 'clarify', clarification: 'canteen' }, { context: initial.context, history, fetchImpl: (_url, request) => {
    const input = JSON.parse(JSON.parse(request.body).input)
    assert.deepEqual(input.history, history)
    return reply(plan({ intent: 'clarify', clarification: 'canteen' }))
  } })
  assert.equal(result.status, 'clarify')
  assert.match(result.answer, /which canteen/i)
  assert.deepEqual(result.context.focus, initial.context.focus)
})

test('greetings honor a saved preference and off-topic turns leave catalog focus intact', async () => {
  const initial = await ask('Tamil please, how much is rice?', { intent: 'price', preference: 'ta', foodIds: ['food-1'] })
  const greeting = greetAssistant('hi!', initial.context)
  assert.equal(greeting.status, 'greeting')
  assert.equal(greeting.language, 'ta')
  assert.deepEqual(greeting.context.focus, initial.context.focus)
  const offTopic = await ask('Who won the match?', { intent: 'off_topic' }, { context: initial.context })
  assert.equal(offTopic.status, 'off_topic')
  assert.deepEqual(offTopic.context.focus, initial.context.focus)
})

test('sanitizes malformed and quota responses', async () => {
  await assert.rejects(() => ask('Wrong call', {}, {
    fetchImpl: () => Response.json({ message: 'test-secret' }, { status: 429 }),
  }), { status: 429, message: 'Gemini quota reached.' })
  await assert.rejects(() => ask('Wrong call', {}, {
    fetchImpl: () => reply({ intent: 'public-data-dump', answer: 'test-secret' }),
  }), { message: 'Gemini response unavailable.' })
})
