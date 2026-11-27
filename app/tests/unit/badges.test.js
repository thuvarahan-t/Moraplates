import test from 'node:test'
import assert from 'node:assert/strict'
import { isVerifiedProfile } from '../../src/lib/badges.js'

test('verification starts at four earned badges', () => {
  const threeBadges = { plates: 1, early_plates: 1, night_plates: 1, foods_added: 4 }
  assert.equal(isVerifiedProfile(), false)
  assert.equal(isVerifiedProfile(threeBadges), false)
  assert.equal(isVerifiedProfile({ ...threeBadges, foods_added: 5 }), true)
  assert.equal(isVerifiedProfile({ ...threeBadges, foods_added: 5, comments_made: 20 }), true)
})
