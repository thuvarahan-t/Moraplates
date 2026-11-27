import test from 'node:test'
import assert from 'node:assert/strict'
import { applyLook, autoAdjust, isNeutral, mixLook, straightenScale } from '../../src/lib/photoEdit.js'

const px = (...rgb) => new Uint8ClampedArray(rgb.flatMap(([r, g, b]) => [r, g, b, 255]))

test('Original with no adjustments leaves pixels untouched', () => {
  const data = px([10, 120, 240], [200, 30, 90])
  const before = [...data]
  const look = mixLook('none', 1, {})
  assert.equal(isNeutral(look), true)
  applyLook(data, 2, 1, look)
  assert.deepEqual([...data], before)
})

test('preset strength scales the look and adjustments add on top, clamped to -1..1', () => {
  const half = mixLook('golden', .5, {})
  const full = mixLook('golden', 1, {})
  assert.ok(Math.abs(half.warmth - full.warmth / 2) < 1e-9)
  assert.equal(mixLook('vivid', 1, { saturation: 1 }).saturation, 1)
})

test('mono removes colour and warmth shifts red up and blue down', () => {
  const grey = px([200, 60, 30])
  applyLook(grey, 1, 1, mixLook('mono', 1, {}))
  assert.ok(Math.abs(grey[0] - grey[1]) <= 1 && Math.abs(grey[1] - grey[2]) <= 1)
  const warm = px([128, 128, 128])
  applyLook(warm, 1, 1, { warmth: .5 })
  assert.ok(warm[0] > 128 && warm[2] < 128)
})

test('vignette darkens corners more than the centre', () => {
  const w = 9, h = 9, data = new Uint8ClampedArray(w * h * 4).fill(200)
  applyLook(data, w, h, { vignette: 1 })
  const at = (x, y) => data[(y * w + x) * 4]
  assert.ok(at(0, 0) < at(4, 4))
  assert.equal(at(4, 4), 200)
})

test('straighten zooms just enough to hide the tilted corners', () => {
  assert.equal(straightenScale(400, 500, 0), 1)
  const s = straightenScale(400, 500, 10)
  assert.ok(s > 1 && s < 1.4)
  assert.equal(straightenScale(400, 500, -10), s)
})

test('auto enhance brightens a dark, flat photo', () => {
  const data = new Uint8ClampedArray(64 * 4)
  for (let i = 0; i < 64; i++) data.set([40 + (i % 30), 40 + (i % 30), 40 + (i % 30), 255], i * 4)
  const a = autoAdjust(data)
  assert.ok(a.brightness > 0 && a.contrast > 0 && a.saturation > 0)
})
