import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon, SearchIcon } from './icons'

const norm = s => (s ?? '').toString().toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim()
const ACTION = '__dd_action'

/** Bolds the part of `text` that matches the search. */
function Hl({ text, q }) {
  const i = q ? norm(text).indexOf(q) : -1
  if (i < 0) return text
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>
}

/**
 * Themed single-select dropdown (listbox pattern).
 * options: [{ value, label, sub?, dot? }]; `dot` is a colour shown as a small circle.
 * searchable: adds a search box at the top of the list (matches label and sub).
 * action: { label(query), sub?, onPick(query) }: an extra row at the end, e.g. "+ Add a new food".
 * openSignal: bump this number to open the list from outside (e.g. after the previous step is done).
 * Mouse, touch and keyboard (arrows, Home/End, Enter/Space, Esc, Tab) all work.
 */
export default function Dropdown({
  labelId, value, options, onChange, placeholder = 'Choose…', disabled = false,
  searchable = false, searchPlaceholder = 'Search…', emptyText = 'Nothing matches', action, openSignal = 0,
}) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const [query, setQuery] = useState('')
  const box = useRef(null)
  const btn = useRef(null)
  const list = useRef(null)
  const pop = useRef(null)
  const search = useRef(null)
  const listId = useId()
  const current = options.find(o => o.value === value)
  const q = norm(query)

  const items = useMemo(() => {
    const shown = q ? options.filter(o => norm(o.label).includes(q) || norm(o.sub).includes(q)) : options
    return action ? [...shown, { value: ACTION, label: action.label(query.trim()), sub: action.sub, isAction: true }] : shown
  }, [options, q, query, action])

  // Close when tapping anywhere else.
  useEffect(() => {
    if (!open) return
    const away = e => { if (!box.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  useEffect(() => { if (openSignal && !disabled) setOpen(true) }, [openSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // On open: highlight the chosen option, bring the list into view, focus search where a keyboard is likely.
  useEffect(() => {
    if (!open) { setQuery(''); return }
    setHi(Math.max(0, options.findIndex(o => o.value === value)))
    requestAnimationFrame(() => {
      pop.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      if (searchable && matchMedia('(pointer: fine)').matches) search.current?.focus({ preventScroll: true })
    })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) list.current?.children[hi]?.scrollIntoView({ block: 'nearest' }) }, [hi, open])
  useEffect(() => { if (q) setHi(0) }, [q])

  const pick = o => {
    if (o.isAction) action.onPick(query.trim())
    else onChange(o.value)
    setOpen(false)
    btn.current?.focus({ preventScroll: true })
  }

  const onKey = (e, inSearch = false) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End']
    if (!open) {
      if (keys.includes(e.key)) { e.preventDefault(); setOpen(true) }
      return
    }
    const last = items.length - 1
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(last, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)) }
    else if (!inSearch && e.key === 'Home') { e.preventDefault(); setHi(0) }
    else if (!inSearch && e.key === 'End') { e.preventDefault(); setHi(last) }
    else if (e.key === 'Enter' || (!inSearch && e.key === ' ')) { e.preventDefault(); if (items[hi]) pick(items[hi]) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); btn.current?.focus() } // close the list, not the dialog
    else if (e.key === 'Tab' && !inSearch) setOpen(false)
  }

  const activeId = open && items[hi] ? `${listId}-${hi}` : undefined

  return (
    <div className={'dd' + (open ? ' open' : '')} ref={box}>
      <button
        type="button" ref={btn} className="dd-btn" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-labelledby={labelId}
        aria-activedescendant={activeId}
        onClick={() => setOpen(o => !o)} onKeyDown={e => onKey(e)}
      >
        {current?.dot && <span className="dd-dot" style={{ background: current.dot }} />}
        <span className={'dd-val' + (current ? '' : ' dd-empty-val')}>
          <b>{current?.label ?? placeholder}</b>
          {current?.sub && <small>{current.sub}</small>}
        </span>
        <ChevronDownIcon className="dd-chev" />
      </button>
      {open && (
        <div className="dd-pop" ref={pop}>
          {searchable && (
            <label className="dd-search">
              <SearchIcon size={16} />
              <input
                ref={search} type="search" value={query} placeholder={searchPlaceholder} enterKeyHint="go"
                aria-label={searchPlaceholder} aria-controls={listId} aria-activedescendant={activeId} autoComplete="off"
                onChange={e => setQuery(e.target.value)} onKeyDown={e => onKey(e, true)}
              />
            </label>
          )}
          <ul className="dd-list" role="listbox" id={listId} ref={list} aria-labelledby={labelId}>
            {items.map((o, i) => {
              const sel = o.value === value
              return (
                <Fragment key={o.value}>
                {o.isAction && i === 0 && q && <li className="dd-empty" role="presentation">{emptyText}</li>}
                <li
                  id={`${listId}-${i}`} role="option" aria-selected={sel}
                  className={(i === hi ? 'hi ' : '') + (sel ? 'sel ' : '') + (o.isAction ? 'act' : '')}
                  onPointerEnter={() => setHi(i)} onClick={() => pick(o)}
                >
                  {o.dot && <span className="dd-dot" style={{ background: o.dot }} />}
                  <span className="dd-val"><b>{o.isAction ? o.label : <Hl text={o.label} q={q} />}</b>{o.sub && <small>{o.sub}</small>}</span>
                  {sel && <CheckIcon />}
                </li>
                </Fragment>
              )
            })}
            {!items.length && <li className="dd-empty" role="presentation">{emptyText}</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
