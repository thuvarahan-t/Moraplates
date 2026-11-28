import { useEffect, useRef, useState } from 'react'
import { REDUCED_MOTION } from '../lib/motion'

/**
 * Cross-fading photo slideshow that fills its (position:relative) parent.
 * `children(current, index, goTo)` renders overlays such as the credit chip and dots.
 */
export default function Slideshow({ photos, interval = 4500, children }) {
  const [i, setI] = useState(0)
  const slides = useRef(null)
  const n = photos.length

  useEffect(() => {
    if (REDUCED_MOTION || n < 2) return
    const t = setInterval(() => {
      if (!document.hidden && !slides.current?.parentElement.matches(':hover, :focus-within')) setI(x => (x + 1) % n)
    }, interval)
    return () => clearInterval(t)
  }, [n, interval])

  const idx = n ? i % n : 0
  return (
    <>
      <div ref={slides} className="slides" aria-hidden="true">
        {photos.map((p, k) => <img key={p.id} src={p.url} alt="" className={k === idx ? 'on' : undefined} loading={k < 2 ? 'eager' : 'lazy'} />)}
      </div>
      {n > 0 && children?.(photos[idx], idx, setI)}
    </>
  )
}

/** Small "who added this" chip for the corner of a photo. */
export const Credit = ({ name }) => <span className="credit">📷 {name}</span>

/** Dot indicators; clickable when goTo is given. */
export function Dots({ count, index, goTo, label = 'photo' }) {
  if (count < 2) return null
  return (
    <span className="dots">
      {Array.from({ length: count }, (_, k) => (
        <button key={k} type="button" className={k === index ? 'on' : undefined} aria-label={`Show ${label} ${k + 1}`} aria-current={k === index ? 'true' : undefined}
          onClick={e => { e.preventDefault(); e.stopPropagation(); goTo?.(k) }} />
      ))}
    </span>
  )
}
