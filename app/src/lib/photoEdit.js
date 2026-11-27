// Photo editor engine: geometry (rotate, flip, straighten, crop) and the "look" (filters + adjustments).
// Preview and export run the same pixel code, so what you see is exactly what gets uploaded.
// No canvas `filter` API is used: Safari support is patchy, and warmth/vignette/fade aren't CSS filters anyway.
import { cropRect, decodePhoto, jpegBlob } from './crop.js'

/** Adjustment sliders, each -100..100 in the UI and -1..1 here. */
export const ADJUSTMENTS = [
  ['brightness', 'Brightness'],
  ['contrast', 'Contrast'],
  ['saturation', 'Saturation'],
  ['warmth', 'Warmth'],
  ['fade', 'Fade'],
  ['vignette', 'Vignette'],
]
export const NO_ADJUST = Object.fromEntries(ADJUSTMENTS.map(([k]) => [k, 0]))

/** Food-friendly looks. Values use the same -1..1 scale as the sliders. */
export const PRESETS = [
  { id: 'none', name: 'Original', look: {} },
  { id: 'fresh', name: 'Fresh', look: { brightness: .06, contrast: .14, saturation: .24, warmth: -.04 } },
  { id: 'spicy', name: 'Spicy', look: { contrast: .3, saturation: .45, warmth: .22, vignette: .3 } },
  { id: 'golden', name: 'Golden', look: { brightness: .07, warmth: .55, saturation: .08, fade: .14 } },
  { id: 'vivid', name: 'Vivid', look: { saturation: .65, contrast: .2, brightness: .03 } },
  { id: 'cool', name: 'Cool', look: { warmth: -.42, contrast: .1, saturation: .06 } },
  { id: 'cafe', name: 'Café', look: { warmth: .3, contrast: -.08, saturation: -.12, fade: .32, vignette: .2 } },
  { id: 'moody', name: 'Moody', look: { brightness: -.12, contrast: .28, saturation: -.22, vignette: .55 } },
  { id: 'vintage', name: 'Vintage', look: { saturation: -.32, warmth: .38, fade: .5, contrast: -.1, vignette: .38 } },
  { id: 'mono', name: 'Mono', look: { saturation: -1, contrast: .28 } },
]

/** Preset scaled by its strength (0..1), plus the person's own adjustments on top. */
export function mixLook(presetId, strength, adjust) {
  const look = PRESETS.find(p => p.id === presetId)?.look ?? {}
  const out = {}
  for (const [k] of ADJUSTMENTS) out[k] = Math.max(-1, Math.min(1, (look[k] ?? 0) * strength + (adjust?.[k] ?? 0)))
  return out
}

export const isNeutral = look => ADJUSTMENTS.every(([k]) => !look[k])

/** Applies a look to RGBA pixels in place. Pure: works on any Uint8ClampedArray (unit-testable in Node). */
export function applyLook(data, width, height, look) {
  if (isNeutral(look)) return data
  const { brightness: br = 0, contrast: ct = 0, saturation: sat = 0, warmth: wm = 0, fade: fd = 0, vignette: vg = 0 } = look
  // Tone curve shared by all three channels: brightness, contrast around mid-grey, then lifted blacks for fade.
  const lut = new Uint8ClampedArray(256)
  const cf = ct >= 0 ? 1 + ct * 1.1 : 1 + ct * .7
  for (let v = 0; v < 256; v++) {
    let t = v + br * 70
    t = (t - 128) * cf + 128
    t = t + fd * 46 * (1 - t / 255)
    lut[v] = t
  }
  const sf = 1 + sat, wr = wm * 26, wb = -wm * 30, wg = wm * 4
  const cx = width / 2, cy = height / 2, inv = 1 / Math.hypot(cx, cy)
  for (let y = 0, i = 0; y < height; y++) {
    const dy = (y - cy) ** 2
    for (let x = 0; x < width; x++, i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2]
      if (sf !== 1) {
        const l = .299 * r + .587 * g + .114 * b
        r = l + (r - l) * sf; g = l + (g - l) * sf; b = l + (b - l) * sf
      }
      r = lut[r < 0 ? 0 : r > 255 ? 255 : r | 0] + wr
      g = lut[g < 0 ? 0 : g > 255 ? 255 : g | 0] + wg
      b = lut[b < 0 ? 0 : b > 255 ? 255 : b | 0] + wb
      if (vg) {
        const d = Math.sqrt((x - cx) ** 2 + dy) * inv // 0 centre → 1 corner
        const e = d < .45 ? 0 : ((d - .45) / .55) ** 2
        const m = 1 - vg * e * .75
        r *= m; g *= m; b *= m
      }
      data[i] = r; data[i + 1] = g; data[i + 2] = b
    }
  }
  return data
}

/** One-tap enhance: stretch the tones to a healthy range and add a little colour. Returns slider values. */
export function autoAdjust(data) {
  const hist = new Uint32Array(256)
  let n = 0, sum = 0
  for (let i = 0; i < data.length; i += 16) { // every 4th pixel is plenty
    const l = (.299 * data[i] + .587 * data[i + 1] + .114 * data[i + 2]) | 0
    hist[l]++; n++; sum += l
  }
  const pct = p => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * p) return v } return 255 }
  const lo = pct(.02), hi = pct(.98), mean = sum / Math.max(1, n)
  const round = (v, cap) => Math.round(Math.max(-cap, Math.min(cap, v)) * 100) / 100
  // Food photos are often bright (white plates), so only nudge exposure when it is clearly off.
  const exposure = mean < 105 ? (115 - mean) / 115 : mean > 185 ? -(mean - 175) / 160 : 0
  return {
    ...NO_ADJUST,
    contrast: round((Math.min(1.4, 225 / Math.max(40, hi - lo)) - 1) / 1.1 + .06, .35),
    brightness: round(exposure, .3),
    saturation: .16,
  }
}

/** Source scaled to at most `maxSide` and turned by quarter turns, so the crop maths never deals with 90° rotations. */
export function makeBase(img, quarter = 0, maxSide = 2400) {
  const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height
  const s = Math.min(1, maxSide / Math.max(w0, h0))
  const w = Math.round(w0 * s), h = Math.round(h0 * s)
  const turn = ((quarter % 4) + 4) % 4
  const c = document.createElement('canvas')
  c.width = turn % 2 ? h : w
  c.height = turn % 2 ? w : h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Photo processing is unavailable.')
  ctx.translate(c.width / 2, c.height / 2)
  ctx.rotate(turn * Math.PI / 2)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  return c
}

/** How much to zoom so a box tilted by `deg` still covers the frame with no empty corners. */
export function straightenScale(w, h, deg) {
  const t = Math.abs(deg) * Math.PI / 180, c = Math.cos(t), s = Math.sin(t)
  return Math.max((w * c + h * s) / w, (w * s + h * c) / h)
}

/** The crop frame (in base pixels) for the current settings. `ratio` null means the photo's own shape. */
export function frameFor(base, { ratio, zoom, x, y }) {
  return cropRect(base.width, base.height, ratio || base.width / base.height, zoom, x, y)
}

/**
 * Draws the edited photo into `canvas` (at most `max` px on the long side) and applies the look.
 * Straighten zooms in about the frame centre just enough to hide the corners, so the tilted sample
 * always stays inside the frame and therefore inside the photo.
 */
export function renderEdit(canvas, base, geo, look, max = 1600) {
  const rect = frameFor(base, geo)
  const k = Math.min(1, max / Math.max(rect.width, rect.height))
  canvas.width = Math.max(1, Math.round(rect.width * k))
  canvas.height = Math.max(1, Math.round(rect.height * k))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Photo processing is unavailable.')
  const s = straightenScale(rect.width, rect.height, geo.angle || 0)
  ctx.save()
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((geo.angle || 0) * Math.PI / 180)
  ctx.scale((geo.flip ? -1 : 1) * k * s, k * s)
  ctx.drawImage(base, -(rect.x + rect.width / 2), -(rect.y + rect.height / 2))
  ctx.restore()
  if (look && !isNeutral(look)) {
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height)
    applyLook(px.data, canvas.width, canvas.height, look)
    ctx.putImageData(px, 0, 0)
  }
  return ctx
}

/** Everything the editor remembers, so reopening it continues from the last edit instead of starting over. */
export const defaultEdit = fixedAspect => ({
  quarter: 0, ratio: fixedAspect || null, zoom: 1, x: .5, y: .5, angle: 0, flip: false,
  preset: 'none', strength: 1, adjust: NO_ADJUST,
})

/** Renders a photo with an edit state (default: as taken, centre-cropped to `fixedAspect`) to an upload-ready JPEG. */
export async function exportPhoto(file, { fixedAspect, max = 1600, edit } = {}) {
  const e = edit ?? defaultEdit(fixedAspect)
  const img = await decodePhoto(file)
  const base = makeBase(img, e.quarter)
  const out = document.createElement('canvas')
  renderEdit(out, base, e, mixLook(e.preset, e.strength, e.adjust), max)
  const blob = await jpegBlob(out)
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
}
