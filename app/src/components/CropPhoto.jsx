import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Aperture, CloudFog, Contrast, Crop, Droplet, Eye, FlipHorizontal2, Image as ImageIcon, Pencil, RectangleHorizontal,
  RectangleVertical, RotateCcw, RotateCw, SlidersHorizontal, Sparkles, Square, Sun, Thermometer, WandSparkles,
} from 'lucide-react'
import { decodePhoto, jpegBlob } from '../lib/crop'
import { ADJUSTMENTS, NO_ADJUST, PRESETS, applyLook, autoAdjust, defaultEdit, frameFor, isNeutral, makeBase, mixLook, renderEdit } from '../lib/photoEdit'

const RATIOS = [
  [null, 'Original', ImageIcon],
  [1, 'Square', Square],
  [4 / 5, '4:5', RectangleVertical],
  [3 / 4, '3:4', RectangleVertical],
  [9 / 16, '9:16', RectangleVertical],
  [4 / 3, '4:3', RectangleHorizontal],
  [16 / 9, '16:9', RectangleHorizontal],
]
const ADJ_ICONS = { brightness: Sun, contrast: Contrast, saturation: Droplet, warmth: Thermometer, fade: CloudFog, vignette: Aperture }
const TABS = [['crop', 'Crop', Crop], ['filters', 'Filters', Sparkles], ['adjust', 'Adjust', SlidersHorizontal]]
const clamp01 = v => Math.max(0, Math.min(1, v))
const clampZoom = v => Math.max(1, Math.min(3, v))

/**
 * Photo editor used everywhere a photo is added: crop (shape, drag, pinch/scroll zoom, rotate, flip, straighten),
 * food filters with strength, manual adjustments and one-tap Auto. Hold the eye to compare with the original.
 * Opens from the ✏️ on a picked photo. `file` is always the untouched original; `initial` is the last edit,
 * so reopening carries on where the person left off. onDone(editedFile, editState).
 */
export default function CropPhoto({ file, onDone, onCancel, fixedAspect, max = 1600, initial }) {
  const start = initial ?? defaultEdit(fixedAspect)
  const [img, setImg] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState(initial && initial.preset !== 'none' ? 'filters' : 'crop')

  const [quarter, setQuarter] = useState(start.quarter)
  const [ratio, setRatio] = useState(start.ratio)
  const [zoom, setZoom] = useState(start.zoom)
  const [pos, setPos] = useState({ x: start.x, y: start.y })
  const [angle, setAngle] = useState(start.angle)
  const [flip, setFlip] = useState(start.flip)

  const [preset, setPreset] = useState(start.preset)
  const [strength, setStrength] = useState(start.strength)
  const [adjust, setAdjust] = useState(start.adjust)
  const [compare, setCompare] = useState(false)
  const [moving, setMoving] = useState(false)
  const [thumbs, setThumbs] = useState({})

  const canvas = useRef(null)
  const pointers = useRef(new Map())
  const gesture = useRef(null)

  useEffect(() => {
    let live = true
    setImg(null); setError('')
    decodePhoto(file).then(i => { if (live) setImg(i) }).catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [file])

  const base = useMemo(() => {
    if (!img) return null
    try { return makeBase(img, quarter) } catch (e) { setError(e.message); return null }
  }, [img, quarter])

  const geo = useMemo(() => ({ ratio, zoom, x: pos.x, y: pos.y, angle, flip }), [ratio, zoom, pos, angle, flip])
  const look = useMemo(() => mixLook(preset, strength, adjust), [preset, strength, adjust])
  const edited = !isNeutral(look) || quarter || flip || angle || zoom !== 1 || pos.x !== .5 || pos.y !== .5 || (!fixedAspect && ratio !== null)

  // Live preview, at most one render per frame.
  useEffect(() => {
    if (!base || !canvas.current) return
    const f = requestAnimationFrame(() => {
      try { renderEdit(canvas.current, base, geo, compare ? null : look, 720) } catch (e) { setError(e.message) }
    })
    return () => cancelAnimationFrame(f)
  }, [base, geo, look, compare])

  // Filter thumbnails show the current crop, refreshed shortly after the crop settles.
  useEffect(() => {
    if (tab !== 'filters' || !base) return
    const t = setTimeout(() => {
      const small = document.createElement('canvas')
      const ctx = renderEdit(small, base, geo, null, 132)
      const src = ctx.getImageData(0, 0, small.width, small.height)
      const next = {}
      for (const p of PRESETS) {
        const px = new ImageData(new Uint8ClampedArray(src.data), small.width, small.height)
        applyLook(px.data, px.width, px.height, mixLook(p.id, 1, NO_ADJUST))
        ctx.putImageData(px, 0, 0)
        next[p.id] = small.toDataURL('image/jpeg', .82)
      }
      setThumbs(next)
    }, 120)
    return () => clearTimeout(t)
  }, [tab, base, geo])

  const resetCrop = () => { setZoom(1); setPos({ x: .5, y: .5 }); setAngle(0) }
  const resetAll = () => {
    resetCrop(); setQuarter(0); setFlip(false); setRatio(fixedAspect || null)
    setPreset('none'); setStrength(1); setAdjust(NO_ADJUST)
  }

  const runAuto = () => {
    if (!base) return
    const c = document.createElement('canvas')
    const ctx = renderEdit(c, base, geo, null, 320)
    setAdjust(autoAdjust(ctx.getImageData(0, 0, c.width, c.height).data))
    setTab('adjust')
  }

  // ---- drag to move, pinch or scroll to zoom, arrow keys for keyboard users ----
  const panBy = useCallback((dx, dy, w, h, from) => {
    if (!base) return
    const rect = frameFor(base, geo)
    const sx = flip ? -1 : 1
    setPos({
      x: base.width > rect.width ? clamp01(from.x - sx * dx * rect.width / w / (base.width - rect.width)) : .5,
      y: base.height > rect.height ? clamp01(from.y - dy * rect.height / h / (base.height - rect.height)) : .5,
    })
  }, [base, geo, flip])

  const down = e => {
    if (!base) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setMoving(true)
    const pts = [...pointers.current.values()]
    gesture.current = pts.length >= 2
      ? { pinch: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), zoom }
      : { x: e.clientX, y: e.clientY, from: pos, w: e.currentTarget.clientWidth, h: e.currentTarget.clientHeight }
  }
  const move = e => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    const pts = [...pointers.current.values()]
    if (g.pinch && pts.length >= 2) setZoom(clampZoom(g.zoom * Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.pinch))
    else if (!g.pinch) panBy(e.clientX - g.x, e.clientY - g.y, g.w, g.h, g.from)
  }
  const up = e => {
    pointers.current.delete(e.pointerId)
    if (!pointers.current.size) { gesture.current = null; setMoving(false) }
    else { // one finger left after a pinch: carry on dragging from here
      const [p] = pointers.current.values()
      gesture.current = { x: p.x, y: p.y, from: pos, w: e.currentTarget.clientWidth, h: e.currentTarget.clientHeight }
    }
  }
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const wheel = e => { e.preventDefault(); setZoom(z => clampZoom(z * (1 - e.deltaY * .0015))) }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [base])
  const key = e => {
    const step = .03
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (moves[e.key]) { e.preventDefault(); const [dx, dy] = moves[e.key]; setPos(p => ({ x: clamp01(p.x + dx), y: clamp01(p.y + dy) })) }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(z => clampZoom(z + .1)) }
    else if (e.key === '-') { e.preventDefault(); setZoom(z => clampZoom(z - .1)) }
  }

  const finish = async () => {
    if (!base || busy) return
    setBusy(true); setError('')
    try {
      const out = document.createElement('canvas')
      renderEdit(out, base, geo, look, max)
      const blob = await jpegBlob(out)
      onDone(new File([blob], 'photo.jpg', { type: 'image/jpeg' }), { quarter, ...geo, preset, strength, adjust })
    } catch (e) { setError(e.message); setBusy(false) }
  }

  const holdCompare = on => ({
    onPointerDown: e => { e.preventDefault(); setCompare(true) }, onPointerUp: () => setCompare(false),
    onPointerLeave: () => setCompare(false), onPointerCancel: () => setCompare(false),
    onKeyDown: e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setCompare(true) } },
    onKeyUp: () => setCompare(false), 'aria-pressed': on,
  })

  return (
    <section className="crop-editor pe" aria-label="Crop photo">
      <div className="pe-head">
        <h3><WandSparkles size={18} aria-hidden="true" /> Edit photo</h3>
        <div className="pe-head-acts">
          <button type="button" className="pe-icon" disabled={!base || isNeutral(look)} aria-label="Hold to compare with the original" title="Hold to compare" {...holdCompare(compare)}><Eye size={18} /></button>
          <button type="button" className="mini" onClick={resetAll} disabled={!edited}><RotateCcw size={16} /> Reset</button>
        </div>
      </div>

      <div className={'pe-stage' + (moving ? ' moving' : '')}>
        {img && base ? (
          <div className="pe-frame">
            <canvas ref={canvas} className="crop-preview" tabIndex={0}
              aria-label="Crop preview. Drag to move, pinch or scroll to zoom, arrow keys to move, plus and minus to zoom"
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key} />
            <span className="pe-grid" aria-hidden="true" />
            {compare && <span className="pe-badge">Original</span>}
          </div>
        ) : !error && <p className="pe-loading" role="status">Preparing photo…</p>}
      </div>

      <div className="pe-tabs" role="tablist" aria-label="Editing tools">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} disabled={!base}>
            <Icon size={16} aria-hidden="true" />{label}
            {id === 'filters' && preset !== 'none' && <i className="pe-dot" />}
            {id === 'adjust' && !isNeutral(adjust) && <i className="pe-dot" />}
          </button>
        ))}
      </div>

      <div className="pe-panel" role="tabpanel" key={tab}>
        {tab === 'crop' && <>
          {!fixedAspect && (
            <div className="chips scroll pe-ratios">
              {RATIOS.map(([v, label, Icon]) => (
                <button key={label} type="button" className={'chip' + (ratio === v ? ' on' : '')} aria-pressed={ratio === v}
                  onClick={() => { setRatio(v); setZoom(1); setPos({ x: .5, y: .5 }) }}>
                  <Icon size={15} aria-hidden="true" />{label}
                </button>
              ))}
            </div>
          )}
          <div className="pe-tools">
            <button type="button" className="pe-tool" onClick={() => { setQuarter(q => q - 1); resetCrop() }} disabled={!base}><RotateCcw size={18} aria-hidden="true" />Rotate left</button>
            <button type="button" className="pe-tool" onClick={() => { setQuarter(q => q + 1); resetCrop() }} disabled={!base}><RotateCw size={18} aria-hidden="true" />Rotate right</button>
            <button type="button" className={'pe-tool' + (flip ? ' on' : '')} aria-pressed={flip} onClick={() => setFlip(f => !f)} disabled={!base}><FlipHorizontal2 size={18} aria-hidden="true" />Flip</button>
          </div>
          <Slider label="Zoom" value={zoom} min={1} max={3} step={.01} show={`${zoom.toFixed(1)}×`} onChange={setZoom} disabled={!base} onReset={() => setZoom(1)} def={1} />
          <Slider label="Straighten" value={angle} min={-15} max={15} step={.5} show={`${angle > 0 ? '+' : ''}${angle}°`} onChange={setAngle} disabled={!base} onReset={() => setAngle(0)} centered />
        </>}

        {tab === 'filters' && <>
          <div className="pe-filters" role="radiogroup" aria-label="Filters">
            {PRESETS.map(p => (
              <button key={p.id} type="button" role="radio" aria-checked={preset === p.id} className={'pe-filter' + (preset === p.id ? ' on' : '')}
                onClick={() => { setPreset(p.id); setStrength(1) }}>
                <span className="pe-thumb">{thumbs[p.id] ? <img src={thumbs[p.id]} alt="" /> : <i />}</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          {preset !== 'none' && <Slider label="Strength" value={strength} min={0} max={1} step={.01} show={`${Math.round(strength * 100)}%`} onChange={setStrength} onReset={() => setStrength(1)} def={1} />}
        </>}

        {tab === 'adjust' && <>
          <button type="button" className="pe-auto" onClick={runAuto} disabled={!base}><WandSparkles size={17} aria-hidden="true" />Auto enhance</button>
          <div className="pe-adjust">
            {ADJUSTMENTS.map(([k, label]) => {
              const Icon = ADJ_ICONS[k]
              const v = Math.round(adjust[k] * 100)
              return <Slider key={k} label={<><Icon size={15} aria-hidden="true" />{label}</>} aria={label} value={v} min={-100} max={100} step={1}
                show={v > 0 ? `+${v}` : `${v}`} centered onChange={n => setAdjust(a => ({ ...a, [k]: n / 100 }))} onReset={() => setAdjust(a => ({ ...a, [k]: 0 }))} />
            })}
          </div>
        </>}
      </div>

      {error && <p className="err" role="alert">{error}</p>}
      <div className="cacts">
        <button className="btn ghost sm" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn sm" type="button" onClick={finish} disabled={!base || busy || !!error}>{busy ? 'Saving…' : 'Done'}</button>
      </div>
    </section>
  )
}

/** Labelled range with its value; tap the value to reset. `centered` fills from the middle (for -/+ sliders). */
function Slider({ label, aria, value, min, max, step, show, onChange, onReset, disabled, centered, def = 0 }) {
  const pct = (value - min) / (max - min) * 100
  const fill = centered
    ? { '--a': `${Math.min(50, pct)}%`, '--b': `${Math.max(50, pct)}%` }
    : { '--a': '0%', '--b': `${pct}%` }
  const changed = value !== def
  return (
    <div className="pe-slider">
      <div className="pe-sl-top">
        <span className="pe-sl-label">{label}</span>
        <button type="button" className={'pe-sl-val' + (changed ? ' changed' : '')} onClick={onReset} disabled={disabled || !changed}
          aria-label={`Reset ${aria ?? label}`}>{show}</button>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} style={fill}
        aria-label={aria ?? (typeof label === 'string' ? label : undefined)} onChange={e => onChange(+e.target.value)}
        onDoubleClick={onReset} />
    </div>
  )
}

/** The ✏️ on a picked photo that opens the editor. `label` adds text beside the icon on wide tiles. */
export function EditPhotoButton({ onClick, disabled, label }) {
  return (
    <button type="button" className={'photo-edit' + (label ? ' wide' : '')} onClick={onClick} disabled={disabled}
      aria-label="Edit photo" title="Edit photo: crop, filters, adjust">
      <Pencil size={label ? 15 : 16} strokeWidth={2.4} aria-hidden="true" />{label && <span>{label}</span>}
    </button>
  )
}
