import { useEffect, useId, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from './icons'

/**
 * Themed single-select dropdown (listbox pattern).
 * options: [{ value, label, sub?, dot? }]; `dot` is a colour shown as a small circle.
 * Mouse, touch and keyboard (arrows, Home/End, Enter/Space, Esc, Tab) all work.
 */
export default function Dropdown({ labelId, value, options, onChange, placeholder = 'Choose…', disabled = false }) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const box = useRef(null)
  const btn = useRef(null)
  const list = useRef(null)
  const listId = useId()
  const current = options.find(o => o.value === value)

  // Close when tapping anywhere else.
  useEffect(() => {
    if (!open) return
    const away = e => { if (!box.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  // Highlight the chosen option on open and keep the highlighted one in view.
  useEffect(() => { if (open) setHi(Math.max(0, options.findIndex(o => o.value === value))) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) list.current?.children[hi]?.scrollIntoView({ block: 'nearest' }) }, [hi, open])

  const pick = o => { onChange(o.value); setOpen(false); btn.current?.focus() }

  const onKey = e => {
    const keys = ['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End']
    if (!open) {
      if (keys.includes(e.key)) { e.preventDefault(); setOpen(true) }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(options.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)) }
    else if (e.key === 'Home') { e.preventDefault(); setHi(0) }
    else if (e.key === 'End') { e.preventDefault(); setHi(options.length - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[hi]) pick(options[hi]) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false) } // close the list, not the dialog
    else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <div className={'dd' + (open ? ' open' : '')} ref={box}>
      <button
        type="button" ref={btn} className="dd-btn" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-labelledby={labelId}
        aria-activedescendant={open && options[hi] ? `${listId}-${hi}` : undefined}
        onClick={() => setOpen(o => !o)} onKeyDown={onKey}
      >
        {current?.dot && <span className="dd-dot" style={{ background: current.dot }} />}
        <span className="dd-val">
          <b>{current?.label ?? placeholder}</b>
          {current?.sub && <small>{current.sub}</small>}
        </span>
        <ChevronDownIcon className="dd-chev" />
      </button>
      {open && (
        <ul className="dd-list" role="listbox" id={listId} ref={list} aria-labelledby={labelId}>
          {options.map((o, i) => {
            const sel = o.value === value
            return (
              <li
                key={o.value} id={`${listId}-${i}`} role="option" aria-selected={sel}
                className={(i === hi ? 'hi ' : '') + (sel ? 'sel' : '')}
                onPointerEnter={() => setHi(i)} onClick={() => pick(o)}
              >
                {o.dot && <span className="dd-dot" style={{ background: o.dot }} />}
                <span className="dd-val"><b>{o.label}</b>{o.sub && <small>{o.sub}</small>}</span>
                {sel && <CheckIcon />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
