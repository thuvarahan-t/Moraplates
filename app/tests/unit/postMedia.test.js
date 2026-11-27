import test from 'node:test'
import assert from 'node:assert/strict'
import { needsSquarePostFrame } from '../../src/lib/postMedia.js'

test('post media preserves ordinary crops and frames taller portraits in a square', () => {
  const ordinary = [[512, 512], [1280, 1600], [1200, 1600], [535, 714], [1600, 900], [1600, 1200]]
  for (const [width, height] of ordinary) assert.equal(needsSquarePostFrame(width, height), false)

  assert.equal(needsSquarePostFrame(900, 1600), true)
  assert.equal(needsSquarePostFrame(720, 1100), true)
  assert.equal(needsSquarePostFrame(0, 0), false)
})
