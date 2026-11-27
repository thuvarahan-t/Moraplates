import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { loadAssistantCatalog } from '../../server/assistant-catalog.js'
import { askAssistantModel, greetAssistant } from '../../server/assistant-model.js'

const app = fileURLToPath(new URL('../..', import.meta.url))
const env = loadEnv('development', app, '')
assert.ok(env.GEMINI_API_KEY?.trim(), 'Set GEMINI_API_KEY before running the live conversation checks.')

const fixture = {
  canteens: [
    { id: 'it', name: 'IT Canteen', location: 'IT Faculty', openNow: true, opensAt: '07:00', closesAt: '19:00' },
    { id: 'wus', name: 'WUS Canteen', location: 'Student Centre', openNow: false, opensAt: '08:00', closesAt: '17:30' },
  ],
  foods: [
    { id: 'it-kottu', canteenId: 'it', name: 'Kottu', priceLkr: 300, totalRatings: 24, superCount: 19 },
    { id: 'it-rolls', canteenId: 'it', name: 'Rolls', priceLkr: 80, totalRatings: 3, superCount: 3 },
    { id: 'wus-rolls', canteenId: 'wus', name: 'Rolls', priceLkr: 95, totalRatings: 2, superCount: 1 },
  ],
}

let count = 0
const failures = []
let retriedQuota = false

async function askLive(request) {
  try {
    return await askAssistantModel(request)
  } catch (error) {
    if (error?.status !== 429 || retriedQuota) throw error
    retriedQuota = true
    console.log('Gemini reached its quota for this window. Retrying once in one minute.')
    await setTimeout(60_000)
    return askAssistantModel(request)
  }
}

function chat(catalog = fixture) {
  let context = null
  const history = []
  return async (question, expect) => {
    const result = greetAssistant(question, context) ?? await askLive({
      apiKey: env.GEMINI_API_KEY, question, catalog, context, history: history.slice(-8),
    })
    console.log(`${result.language} ${result.status} | ${question} | ${result.answer.replaceAll('\n', ' / ')}`)
    try {
      expect(result)
      count++
    } catch (error) {
      failures.push(`${question}: ${error.message}`)
    }
    context = result.context
    if (['answer', 'clarify', 'no_data', 'language'].includes(result.status)) history.push({ question, answer: result.answer })
  }
}

const say = chat()
await say('wot can I git at IT kantin for up to 300 rupees?', result => {
  assert.equal(result.language, 'en')
  assert.match(result.answer, /Kottu.*Rs\. 300/)
  assert.deepEqual(result.context.focus.canteenIds, ['it'])
})
await say('actually atha vida kammi, 150 kulla', result => {
  assert.equal(result.language, 'tanglish')
  assert.equal(result.context.focus.maxPriceLkr, 150)
  assert.deepEqual(result.context.focus.canteenIds, ['it'])
  assert.match(result.answer, /Rolls.*80/)
  assert.doesNotMatch(result.answer, /Kottu/)
})
await say('onnu choos pannunga', result => {
  assert.equal(result.language, 'tanglish')
  assert.equal(result.context.focus.intent, 'recommend')
  assert.match(result.answer, /IT Canteen.*Rolls.*80/)
  assert.doesNotMatch(result.answer, /Kottu|WUS/)
})
await say('adhoda price?', result => {
  assert.equal(result.language, 'tanglish')
  assert.match(result.answer, /IT Canteen.*Rolls.*80/)
  assert.doesNotMatch(result.answer, /95/)
})
await say('could you keep it Sinhala, but type it in English letters?', result => {
  assert.equal(result.status, 'language')
  assert.equal(result.context.languagePreference, 'singlish')
})
await say('what time does that place close?', result => {
  assert.equal(result.language, 'singlish')
  assert.match(result.answer, /IT Canteen.*19:00/)
})
await say('தமிழ்ல பதில் சொல்லுங்க', result => {
  assert.equal(result.status, 'language')
  assert.equal(result.context.languagePreference, 'ta')
})
await say('Rolls එකේ මිල කීයද?', result => {
  assert.equal(result.language, 'ta')
  assert.match(result.answer, /Rolls.*ரூ\./)
})
await say('switch back to matching my messages', result => {
  assert.equal(result.status, 'language')
  assert.equal(result.context.languagePreference, null)
})
await say('WUS canteen இப்போ திறந்திருக்கா?', result => {
  assert.equal(result.language, 'ta')
  assert.match(result.answer, /WUS Canteen/)
  assert.equal(result.context.focus.intent, 'open')
  assert.deepEqual(result.context.focus.canteenIds, ['wus'])
})

await chat()('wus kantime roll ekee mila kochchra da?', result => {
  assert.equal(result.language, 'singlish')
  assert.match(result.answer, /WUS Canteen.*Rolls.*95/)
})
await chat()('රු. 300ට අඩුවෙන් IT කැන්ටිමේ මොනවද තියෙන්නේ?', result => {
  assert.equal(result.language, 'si')
  assert.equal(result.context.focus.exclusive, true)
  assert.match(result.answer, /Rolls.*80/)
  assert.doesNotMatch(result.answer, /Kottu/)
})
await chat()('What does a unicorn burger cost at WUS?', result => {
  assert.equal(result.status, 'no_data')
  assert.doesNotMatch(result.answer, /Rolls|95/)
})

const needsCanteen = chat()
await needsCanteen('When does that canteen close?', result => {
  assert.equal(result.status, 'clarify')
  assert.match(result.answer, /which canteen/i)
})
await needsCanteen('The WUS one', result => {
  assert.equal(result.status, 'answer')
  assert.match(result.answer, /WUS Canteen.*17:30/)
})

const currentCatalog = await loadAssistantCatalog({ url: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY })
const mora = chat(currentCatalog)
await mora('hi', result => assert.equal(result.status, 'greeting'))
await mora('300 kulla price irukura food sollu', result => {
  assert.equal(result.language, 'tanglish')
  assert.equal(result.context.focus.intent, 'menu')
  assert.equal(result.context.focus.maxPriceLkr, 300)
  assert.match(result.answer, /Rs\. /)
})
await mora('nee ondu suggest pannu best ah', result => {
  assert.equal(result.language, 'tanglish')
  assert.equal(result.status, 'answer')
  assert.equal(result.context.focus.intent, 'recommend')
  const prices = [...result.answer.matchAll(/Rs\. (\d+(?:\.\d+)?)/g)].map(match => Number(match[1]))
  assert.equal(prices.length, 1)
  assert.ok(prices[0] <= 300)
})
console.log(`${count} Helena conversation checks passed.`)
assert.deepEqual(failures, [])
