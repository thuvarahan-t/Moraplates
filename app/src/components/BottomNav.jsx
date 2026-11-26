import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { NavLink } from './NavLinks'
import { FeedIcon, PlusIcon, StoreIcon, TrophyIcon, UserIcon } from './icons'
import { usePost } from '../lib/post'

/** Floating glass tab bar for phones (shown under 760px by CSS), with a sliding active pill. */
export default function BottomNav() {
  const { openPost } = usePost()
  const { pathname } = useLocation()
  const bar = useRef(null)
  const pill = useRef(null)

  useLayoutEffect(() => {
    const place = () => {
      const a = bar.current.querySelector('a[aria-current]')
      const el = pill.current
      if (!a) { el.style.opacity = '0'; return }
      el.style.opacity = '1'
      el.style.width = a.offsetWidth + 'px'
      el.style.height = a.offsetHeight + 'px'
      el.style.transform = `translate(${a.offsetLeft}px, ${a.offsetTop}px)`
    }
    place()
    addEventListener('resize', place)
    document.fonts?.ready.then(place)
    return () => removeEventListener('resize', place)
  }, [pathname])

  return (
    <nav className="bnav" aria-label="Main" ref={bar}>
      <span className="bpill" aria-hidden="true" ref={pill} />
      <NavLink to="/" end><FeedIcon />Feed</NavLink>
      <NavLink to="/canteens"><StoreIcon />Canteens</NavLink>
      <button className="plus" onClick={openPost} aria-label="Post your plate">
        <PlusIcon size={24} style={{ strokeWidth: 2.6 }} />
      </button>
      <NavLink to="/top"><TrophyIcon size={24} />Top</NavLink>
      <NavLink to="/profile"><UserIcon size={24} />Profile</NavLink>
    </nav>
  )
}
