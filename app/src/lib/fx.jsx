import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { REDUCED_MOTION } from './motion'
import { CheckIcon } from '../components/icons'

const FxContext = createContext(null)

/** Confetti burst at viewport point (x, y). Same particles and timing as index.html. */
export function confetti(x, y, n = 20) {
  if (REDUCED_MOTION) return
  const cols = ['#E8492F', '#F2A922', '#2F9E5B', '#6B1E2A']
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i')
    const a = Math.random() * Math.PI * 2
    const d = 50 + Math.random() * (n > 10 ? 110 : 50)
    s.className = 'cf'
    s.style.cssText = `left:${x}px;top:${y}px;background:${cols[i % 4]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 30}px;--r:${Math.random() * 540}deg`
    document.body.appendChild(s)
    setTimeout(() => s.remove(), 950)
  }
}

/** Centre of an element in viewport coordinates. */
export const centreOf = el => {
  const r = el.getBoundingClientRect()
  return [r.left + r.width / 2, r.top + r.height / 2]
}

export function FxProvider({ children }) {
  const [msg, setMsg] = useState('')
  const [on, setOn] = useState(false)
  const timer = useRef(0)

  const toast = useCallback(m => {
    setMsg(m)
    setOn(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOn(false), 2400)
  }, [])

  const value = useMemo(() => ({ toast, confetti }), [toast])

  return (
    <FxContext.Provider value={value}>
      {children}
      <div id="toast" className={on ? 'on' : undefined} role="status" aria-live="polite">
        {msg && <><CheckIcon />{msg}</>}
      </div>
    </FxContext.Provider>
  )
}

export const useFx = () => useContext(FxContext)
