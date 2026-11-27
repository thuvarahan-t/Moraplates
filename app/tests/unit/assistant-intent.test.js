import assert from 'node:assert/strict'
import test from 'node:test'
import { interpretAssistantQuestion } from '../../server/assistant-intent.js'

const catalog = {
  canteens: [{ id: 'canteen-1', name: 'IT Canteen', location: 'IT building', opensAt: '06:00', openNow: true }],
  foods: [{ id: 'food-1', name: 'Rice', canteenId: 'canteen-1', priceLkr: 200, totalRatings: 1 }],
}
const plan = {
  intent: 'recommend', language: 'tanglish', preference: 'keep',
  canteenIds: ['canteen-1'], foodIds: [], foodQuery: null, canteenQuery: null,
  maxPriceLkr: 250, exclusive: false, openOnly: false, limit: 1,
  sort: 'default', clarification: 'choice', details: [],
}
const interaction = value => Response.json({ status: 'completed', steps: [
  { type: 'thought', content: [{ type: 'text', text: 'Internal deliberation' }] },
  { type: 'model_output', content: [{ type: 'text', text: JSON.stringify(value) }] },
] })

test('requests a menu lookup plan using prior context and public catalog labels', async () => {
  const context = { languagePreference: 'si', lastLanguage: 'en', focus: {
    intent: 'menu', canteenIds: ['canteen-1'], foodIds: [], maxPriceLkr: 250, exclusive: false,
  } }
  const history = [{ question: 'What food is within Rs. 250 at IT?', answer: 'IT Canteen lists rice.' }]
  const question = 'athula onnu pick pannu'
  const result = await interpretAssistantQuestion({
    apiKey: 'planner-secret', question, history, context, catalog,
    fetchImpl: (url, request) => {
      assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/interactions')
      assert.equal(request.headers['x-goog-api-key'], 'planner-secret')
      assert.equal(request.redirect, 'error')
      assert.ok(request.signal instanceof AbortSignal)
      const body = JSON.parse(request.body)
      assert.equal(body.store, false)
      assert.equal(body.response_format.mime_type, 'application/json')
      assert.deepEqual(body.response_format.schema.properties.maxPriceLkr.type, ['number', 'null'])
      assert.deepEqual(JSON.parse(body.input), {
        question, history, context,
        catalog: {
          canteens: [{ id: 'canteen-1', name: 'IT Canteen', location: 'IT building' }],
          foods: [{ id: 'food-1', name: 'Rice', canteenId: 'canteen-1' }],
          truncated: false,
        },
      })
      return interaction(plan)
    },
  })
  assert.deepEqual(result, plan)
})

test('sanitizes a failed provider response and preserves the quota signal', async () => {
  const args = { apiKey: 'planner-secret', question: 'Hi', catalog }
  await assert.rejects(interpretAssistantQuestion({ ...args,
    fetchImpl: () => Response.json({ error: 'planner-secret' }, { status: 429 }),
  }), { status: 429, message: 'Gemini quota reached.' })
  await assert.rejects(interpretAssistantQuestion({ ...args,
    fetchImpl: () => interaction({ intent: 'planner-secret' }),
  }), { message: 'Gemini response unavailable.' })
})
