import { useEffect } from 'react'
import { REDUCED_MOTION } from './motion'

/** Document-wide pointer tilt for any `.tilt` element (mouse only), as in index.html. */
export function useTilt() {
  useEffect(() => {
    if (REDUCED_MOTION) return
    const move = e => {
      if (e.pointerType !== 'mouse') return
      const el = e.target.closest?.('.tilt')
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--rx', (((e.clientY - r.top) / r.height - 0.5) * -6).toFixed(2) + 'deg')
      el.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 8).toFixed(2) + 'deg')
    }
    const out = e => {
      const el = e.target.closest?.('.tilt')
      if (el && !el.contains(e.relatedTarget)) {
        el.style.setProperty('--rx', '0deg')
        el.style.setProperty('--ry', '0deg')
      }
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerout', out)
    return () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerout', out)
    }
  }, [])
}
