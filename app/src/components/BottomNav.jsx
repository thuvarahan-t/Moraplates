import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { FeedIcon, PlusIcon, StoreIcon, TrophyIcon, UserIcon } from './icons'
import { tapHaptic } from '../lib/feedback'
import { usePost } from '../lib/post'

const TABS = [
  { path: '/', label: 'Feed', icon: FeedIcon },
  { path: '/canteens', label: 'Canteens', icon: StoreIcon },
  { path: '/top', label: 'Top', icon: TrophyIcon },
  { path: '/profile', label: 'Profile', icon: UserIcon },
]
const HOLD_MS = 230
const MOVE_THRESHOLD = 9

function placePill(nav, left, width) {
  nav.style.setProperty('--nav-pill-x', `${left}px`)
  nav.style.setProperty('--nav-pill-width', `${width}px`)
}

function placeActivePill(nav) {
  const active = nav.querySelector('a[aria-current="page"]')
  if (active) placePill(nav, active.offsetLeft, active.offsetWidth)
}

export default function BottomNav() {
  const { openPost } = usePost()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const bar = useRef(null)
  const gesture = useRef(null)
  const suppressClick = useRef(false)
  const [preview, setPreview] = useState(null)

  useLayoutEffect(() => {
    if (!gesture.current?.active) placeActivePill(bar.current)
  }, [pathname])

  useEffect(() => {
    const nav = bar.current
    const observer = new ResizeObserver(() => {
      if (!gesture.current?.active) placeActivePill(nav)
    })
    observer.observe(nav)
    return () => {
      observer.disconnect()
      clearTimeout(gesture.current?.timer)
    }
  }, [])

  function start(event) {
    if (!event.isPrimary || event.button !== 0 || gesture.current) return
    suppressClick.current = false
    const link = event.target.closest('a[data-tab]')
    if (!link) return
    const nav = event.currentTarget
    const hold = { id: event.pointerId, startX: event.clientX, startY: event.clientY, target: link.dataset.tab }
    gesture.current = hold
    hold.timer = setTimeout(() => {
      if (gesture.current !== hold) return
      const rect = nav.getBoundingClientRect()
      hold.tabs = [...nav.querySelectorAll('a[data-tab]')].map(element => ({
        path: element.dataset.tab,
        center: element.offsetLeft + element.offsetWidth / 2,
        width: element.offsetWidth,
      }))
      const first = hold.tabs.find(tab => tab.path === hold.target)
      hold.left = rect.left + nav.clientLeft
      hold.offset = first.center - (hold.startX - hold.left)
      hold.active = true
      suppressClick.current = true
      nav.setPointerCapture(hold.id)
      placePill(nav, first.center - first.width / 2, first.width)
      tapHaptic()
      setPreview(first.path)
    }, HOLD_MS)
  }

  function move(event) {
    const hold = gesture.current
    if (hold?.id !== event.pointerId) return
    const dx = event.clientX - hold.startX
    const dy = event.clientY - hold.startY
    if (!hold.active) {
      if (Math.hypot(dx, dy) > MOVE_THRESHOLD) finish(event, false)
      return
    }
    const nav = event.currentTarget
    const first = hold.tabs[0].center
    const last = hold.tabs.at(-1).center
    const x = Math.max(first, Math.min(last, event.clientX - hold.left + hold.offset))
    const next = hold.tabs.reduce((closest, tab) =>
      Math.abs(tab.center - x) < Math.abs(closest.center - x) ? tab : closest)
    placePill(nav, x - next.width / 2, next.width)
    if (Math.abs(dx) > MOVE_THRESHOLD) hold.moved = true
    if (hold.target !== next.path) {
      hold.target = next.path
      tapHaptic()
      setPreview(next.path)
    }
  }

  function finish(event, select) {
    const hold = gesture.current
    if (hold?.id !== event.pointerId) return
    clearTimeout(hold.timer)
    gesture.current = null
    if (!hold.active) return
    setPreview(null)
    const nav = event.currentTarget
    const rect = nav.getBoundingClientRect()
    if (select && hold.moved && event.clientY >= rect.top - 48 && event.clientY <= rect.bottom + 24) {
      const target = hold.tabs.find(tab => tab.path === hold.target)
      placePill(nav, target.center - target.width / 2, target.width)
      if (nav.querySelector('a[aria-current="page"]')?.dataset.tab !== target.path) navigate(target.path)
    } else {
      placeActivePill(nav)
    }
  }

  return (
    <nav ref={bar} className={preview ? 'bnav is-dragging' : 'bnav'} aria-label="Main"
      onPointerDown={start} onPointerMove={move} onPointerUp={event => finish(event, true)}
      onPointerLeave={event => { if (!gesture.current?.active) finish(event, false) }}
      onPointerCancel={event => finish(event, false)}
      onLostPointerCapture={event => { if (event.target === event.currentTarget) finish(event, false) }}
      onContextMenu={event => { if (event.target.closest('a[data-tab]')) event.preventDefault() }}
      onClickCapture={event => {
        if (!suppressClick.current || event.detail === 0) return
        event.preventDefault()
        event.stopPropagation()
        suppressClick.current = false
      }}>
      <span className="bnav-pill" aria-hidden="true" />
      {TABS.map(({ path, label, icon: Icon }) => (
        <Fragment key={path}>
          {path === '/top' && <button type="button" className="plus" onClick={openPost} aria-label="Post your plate">
            <PlusIcon size={24} style={{ strokeWidth: 2.6 }} />
          </button>}
          <NavLink data-tab={path} data-preview={preview === path || undefined} draggable={false} to={path} end={path === '/'}>
            <Icon size={24} />{label}
          </NavLink>
        </Fragment>
      ))}
    </nav>
  )
}
