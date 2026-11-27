import assert from 'node:assert/strict'
import test from 'node:test'
import { renderAssistantAnswer } from '../../server/assistant-answers.js'

const catalog = {
  canteens: [
    { id: 'c1', name: 'IT Canteen', location: 'IT Faculty', opensAt: '07:00', closesAt: '19:00', openNow: true, votesThisWeek: 12 },
    { id: 'c2', name: 'Goda Uda', lat: 6.80, lng: 79.90, opensAt: '08:00', closesAt: '17:00',
      openNow: false, status: 'Closed today', statusOverrideUntil: '2026-11-28T00:00:00+05:30', votesThisWeek: 23 },
  ],
  foods: [
    { id: 'f1', canteenId: 'c1', name: 'Rolls', priceLkr: 80, totalRatings: 1, superCount: 1 },
    { id: 'f2', canteenId: 'c1', name: 'Kottu', priceLkr: 300, totalRatings: 20, superCount: 16 },
    { id: 'f3', canteenId: 'c2', name: 'Rice', priceLkr: 120, totalRatings: 2, superCount: 1 },
    { id: 'f4', canteenId: 'c2', name: 'Tea', priceLkr: 100, totalRatings: 0, superCount: 0 },
    { id: 'f5', canteenId: 'c1', name: 'Short Eats', priceLkr: null, totalRatings: 0, superCount: 0 },
  ],
}

const ask = (plan, language = 'en', data = catalog) => renderAssistantAnswer({
  plan: { canteenIds: [], foodIds: [], details: [], sort: 'default', ...plan },
  language,
  catalog: data,
})

test('answers both price and canteen hours using the same menu record', () => {
  const reply = ask({ intent: 'price', foodIds: ['f1'], details: ['hours', 'location'] })
  assert.equal(reply.status, 'answer')
  assert.match(reply.answer, /Rolls at IT Canteen.*Rs\. 80.*IT Faculty.*07:00–19:00/)
  assert.doesNotMatch(reply.answer, /Goda Uda/)
})

test('applies an inclusive or exclusive budget, a canteen filter, and current opening status together', () => {
  const plan = { intent: 'menu', canteenIds: ['c1'], maxPriceLkr: 300, openOnly: true, sort: 'cheapest' }
  const inclusive = ask(plan, 'tanglish')
  assert.match(inclusive.answer, /IT Canteen-la Rolls .*Rs\. 80.*Ippo open/)
  assert.match(inclusive.answer, /Kottu .*Rs\. 300/)
  assert.doesNotMatch(inclusive.answer, /Goda Uda|Short Eats/)
  assert.doesNotMatch(ask({ ...plan, exclusive: true }).answer, /Kottu/)
  const closed = ask({ ...plan, canteenIds: ['c2'] })
  assert.equal(closed.status, 'no_data')
  assert.match(closed.answer, /open right now/)
})

test('ranks a larger body of positive feedback above a single perfect score', () => {
  const recommended = ask({ intent: 'recommend', maxPriceLkr: 300 })
  assert.equal(recommended.status, 'answer')
  assert.match(recommended.answer, /Kottu.*16 of 20 ratings/)
  assert.doesNotMatch(recommended.answer, /Rolls/)
  const few = ask({ intent: 'recommend', foodIds: ['f1'] })
  assert.match(few.answer, /1 of 1 ratings.*\nBased on limited ratings/)
  const unrated = ask({ intent: 'recommend', foodIds: ['f4'] })
  assert.match(unrated.answer, /No ratings yet.*\nA practical pick/)
})

test('distinguishes weekly canteen votes, dish ratings, and reported closure', () => {
  let reply = ask({ intent: 'favorites', limit: 1 })
  assert.match(reply.answer, /Goda Uda.*23 votes this week/)
  assert.doesNotMatch(reply.answer, /ratings/)
  reply = ask({ intent: 'ratings', canteenIds: ['c1'] })
  assert.match(reply.answer, /17 of 21 ratings say Super/)
  assert.doesNotMatch(reply.answer, /votes/)
  reply = ask({ intent: 'hours', canteenIds: ['c2'] })
  assert.match(reply.answer, /08:00–17:00.*Reported closed today/)
  assert.match(ask({ intent: 'open', canteenIds: ['c2'], openOnly: true }).answer, /Reported closed today/)
  assert.doesNotMatch(ask({ intent: 'open' }).answer, /Goda Uda/)
})

test('keeps explicit unknown references scoped and flags missing stock or ingredient information', () => {
  assert.deepEqual(ask({ intent: 'menu', canteenQuery: 'Unknown venue' }), {
    status: 'no_data',
    answer: 'I couldn’t find that canteen in the listed data.',
  })
  assert.equal(ask({ intent: 'price', foodQuery: 'Unknown food' }).status, 'no_data')
  assert.match(ask({ intent: 'menu', foodIds: ['f1'], details: ['stock'] }).answer, /doesn’t show live stock/)
  const allergy = ask({ intent: 'recommend', details: ['ingredients'] })
  assert.equal(allergy.status, 'no_data')
  assert.match(allergy.answer, /doesn’t list ingredients/)
  assert.doesNotMatch(allergy.answer, /Rolls|Kottu/)
  assert.deepEqual(ask({ intent: 'clarify', clarification: 'dish' }), { status: 'clarify', answer: 'Which dish do you mean?' })
})

test('delivers equivalent catalog pricing in all five language and script combinations', () => {
  for (const [language, content] of [
    ['en', 'Rolls at IT Canteen · Rs. 80'],
    ['ta', 'IT Canteen-ல Rolls · ரூ. 80'],
    ['si', 'IT Canteen එකේ Rolls · රු. 80'],
    ['tanglish', 'IT Canteen-la Rolls · Rs. 80'],
    ['singlish', 'IT Canteen eke Rolls · Rs. 80'],
  ]) {
    assert.deepEqual(ask({ intent: 'price', foodIds: ['f1'] }, language), { status: 'answer', answer: content })
  }
  assert.equal(renderAssistantAnswer({ plan: { intent: 'greeting' }, language: 'si' }).status, 'greeting')
  assert.match(renderAssistantAnswer({ plan: { intent: 'language', preference: 'auto' }, language: 'en' }).answer, /follow the language/)
})
