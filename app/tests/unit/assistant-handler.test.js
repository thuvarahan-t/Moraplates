import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import { createAssistantHandler } from '../../server/assistant-handler.js'

const env = {
  VITE_SUPABASE_URL: 'https://test.supabase.example',
  VITE_SUPABASE_ANON_KEY: 'publishable-test-key',
  GEMINI_API_KEY: 'gemini-test-key',
}
const userEndpoint = `${env.VITE_SUPABASE_URL}/auth/v1/user`
const accessEndpoint = `${env.VITE_SUPABASE_URL}/rest/v1/rpc/account_access_status`

async function ask(handler, { body, authorization, method = 'POST' } = {}) {
  const request = Readable.from([Buffer.from(JSON.stringify(body ?? { question: 'Which canteens are open?' }))])
  request.method = method
  request.headers = { 'content-type': 'application/json', authorization }
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value }, end(text) { this.body = JSON.parse(text) } }
  await handler(request, response)
  return response
}

test('assistant handles disabled configuration and rejects unverified requests before reading the catalog', async () => {
  const upstreams = []
  const fetchImpl = async url => {
    upstreams.push(String(url))
    return Response.json({ id: 'external', email: 'outside@example.test' })
  }
  const disabled = createAssistantHandler({ ...env, GEMINI_API_KEY: '' }, { fetchImpl })
  const disabledReply = await ask(disabled)
  assert.equal(disabledReply.statusCode, 503)
  assert.equal(disabledReply.body.code, 'not_configured')

  const handler = createAssistantHandler(env, { fetchImpl })
  assert.equal((await ask(handler, { method: 'GET' })).statusCode, 405)
  assert.equal((await ask(handler, { body: { question: 'x'.repeat(401) } })).statusCode, 400)
  assert.equal((await ask(handler)).statusCode, 401)
  assert.deepEqual(upstreams, [])
  assert.equal((await ask(handler, { authorization: 'Bearer external.token' })).statusCode, 401)
  assert.deepEqual(upstreams, [userEndpoint])
})

test('assistant requires an active account before answering even a greeting', async () => {
  for (const [status, expectedCode] of [['banned', 401], ['signed_out', 401], [null, 401], ['unavailable', 503]]) {
    const calls = []
    const authorization = 'Bearer student.token'
    const handler = createAssistantHandler(env, { fetchImpl: async (url, options) => {
      calls.push(url)
      if (url === userEndpoint) return Response.json({ id: 'student-id', email: 'account@uom.lk' })
      assert.equal(url, accessEndpoint)
      assert.equal(options.method, 'POST')
      assert.equal(options.headers.apikey, env.VITE_SUPABASE_ANON_KEY)
      assert.equal(options.headers.Authorization, authorization)
      assert.deepEqual(JSON.parse(options.body), {})
      return status === 'unavailable' ? new Response(null, { status: 503 }) : Response.json(status)
    } })
    const response = await ask(handler, { authorization, body: { question: 'hi' } })
    assert.equal(response.statusCode, expectedCode)
    assert.deepEqual(calls, [userEndpoint, accessEndpoint])
  }
})

test('Helena greets in the selected language without calling the catalog or Gemini', async () => {
  const calls = []
  const handler = createAssistantHandler(env, { fetchImpl: async url => {
    calls.push(url)
    if (url === accessEndpoint) return Response.json('active')
    return Response.json({ id: 'student-id', email: 'account@uom.lk' })
  } })
  const greetings = [['hi', /Hi!/], ['Vanakkam!', /Vanakkam!/], ['வணக்கம்', /வணக்கம்/], ['ආයුබෝවන්', /හායි/]]
  for (const [question, expected] of greetings) {
    const response = await ask(handler, { authorization: 'Bearer student.token', body: { question } })
    assert.equal(response.statusCode, 200)
    assert.equal(response.body.status, 'greeting')
    assert.match(response.body.answer, expected)
  }
  assert.deepEqual(calls, greetings.flatMap(() => [userEndpoint, accessEndpoint]))
})

test('assistant reads public catalog data and omits profile data and contact details from Gemini', async () => {
  let geminiCalls = 0
  const fetchImpl = async (input, options) => {
    const url = new URL(input)
    if (url.pathname === '/auth/v1/user') {
      assert.equal(options.headers.Authorization, 'Bearer student.token')
      return Response.json({ id: 'student-id', email: 'account@uom.lk', user_metadata: { full_name: 'Private Profile Name' } })
    }
    if (url.pathname === '/rest/v1/rpc/account_access_status') {
      assert.equal(options.headers.Authorization, 'Bearer student.token')
      return Response.json('active')
    }
    if (url.pathname === '/rest/v1/canteen_standings') {
      assert.equal(options.headers.Authorization, undefined)
      return Response.json([{ id: 'it', name: 'IT canteen', opens_at: 0, closes_at: 24, location: 'IT Faculty', primary_photo_author: 'Private Author' }])
    }
    if (url.pathname === '/rest/v1/food_stats') return Response.json([])

    geminiCalls += 1
    assert.equal(url.hostname, 'generativelanguage.googleapis.com')
    assert.equal(options.headers['x-goog-api-key'], env.GEMINI_API_KEY)
    const { input: modelInput } = JSON.parse(options.body)
    const { question, history, context, catalog } = JSON.parse(modelInput)
    assert.equal(question, 'Is IT open? My contact is [redacted] and [redacted].')
    assert.equal(history.length, 8)
    assert.deepEqual(history.slice(-2), [
      { question: 'Where is IT?', answer: 'Near the IT Faculty.' },
      { question: 'Any number like [redacted]?', answer: 'There is no listed number.' },
    ])
    assert.equal(context.languagePreference, 'en')
    assert.deepEqual(context.focus.canteenIds, ['canteen-1'])
    assert.deepEqual(catalog.canteens[0], { id: 'canteen-1', name: 'IT canteen', location: 'IT Faculty' })
    assert.doesNotMatch(options.body, /Private Profile Name|Private Author|student-id|student\.token|account@uom\.lk|leaked@uom\.lk|077 123 4567|discard this turn/)
    return Response.json({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify({
      intent: 'open', language: 'en', preference: 'keep', canteenIds: ['canteen-1'],
    }) }] }] })
  }
  const handler = createAssistantHandler(env, { fetchImpl })
  const request = {
    authorization: 'Bearer student.token',
    body: {
      question: 'Is IT open? My contact is leaked@uom.lk and 077 123 4567.',
      name: 'Private Profile Name',
      context: { languagePreference: 'en', focus: { intent: 'location', canteenIds: ['it'] } },
      history: [
        { question: 'discard this turn', answer: 'Old context.' },
        ...Array.from({ length: 6 }, (_, i) => ({ question: `Prior menu question ${i + 1}`, answer: 'Earlier answer.' })),
        { question: 'Where is IT?', answer: 'Near the IT Faculty.', name: 'Private Profile Name' },
        { question: 'Any number like 077 123 4567?', answer: 'There is no listed number.' },
      ],
    },
  }
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await ask(handler, request)
    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['Cache-Control'], 'no-store')
    assert.equal(response.body.status, 'answer')
    assert.match(response.body.answer, /IT canteen.*open/i)
    assert.equal(response.body.language, 'en')
    assert.deepEqual(response.body.context.focus.canteenIds, ['it'])
  }
  const limited = await ask(handler, request)
  assert.equal(limited.statusCode, 429)
  assert.equal(limited.body.code, 'rate_limited')
  assert.equal(geminiCalls, 6)
})
