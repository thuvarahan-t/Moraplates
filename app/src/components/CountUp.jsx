import { useEffect, useState } from 'react'
import { REDUCED_MOTION } from '../lib/motion'

/** Counts from 0 to `to` over 1s with an ease-out cubic (counts() in index.html). */
export default function CountUp({ to, suffix = '', ...props }) {
  const [v, setV] = useState(to)

  useEffect(() => {
    if (REDUCED_MOTION || !to) { setV(to); return }
    const t0 = performance.now()
    let raf
    const step = now => {
      // rAF timestamps can be slightly before t0; clamp so we never show "-0"
      const k = Math.min(1, Math.max(0, (now - t0) / 1000))
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to])

  return <b {...props}>{v.toLocaleString() + suffix}</b>
}
