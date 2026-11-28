import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { Link, NavLink } from './NavLinks'
import NotificationBell from './NotificationBell'
import { PlusIcon, UserIcon } from './icons'
import { usePost } from '../lib/post'
import { initialsOf, useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export const TABS = [
  { to: '/', label: 'Feed', end: true },
  { to: '/canteens', label: 'Canteens' },
  { to: '/top', label: 'Top' },
  { to: '/profile', label: 'Profile' },
]

export const Brand = props => (
  <Link className="brand" to="/" {...props}>
    <svg className="mk" aria-hidden="true"><use href="#mark" /></svg><span className="brand-wordmark"><b>Mora</b>Plates</span>
  </Link>
)

export default function Header() {
  const { pathname } = useLocation()
  const { openPost } = usePost()
  const { profile, session } = useAuth()
  const nav = useRef(null)
  const ind = useRef(null)

  // Sliding pill under the current tab (placeInd in index.html).
  useLayoutEffect(() => {
    const place = () => {
      if (!nav.current || !ind.current) return
      const a = nav.current.querySelector('a[aria-current]')
      const el = ind.current
      if (!a) { el.style.width = '0'; return }
      el.style.width = a.offsetWidth + 'px'
      el.style.transform = `translateX(${a.offsetLeft}px)`
    }
    place()
    addEventListener('resize', place)
    document.fonts?.ready.then(place)
    return () => removeEventListener('resize', place)
  }, [pathname])

  return (
    <header className="top">
      <div className="hw">
        <Brand aria-label="MoraPlates home" />
        <nav className="tabs" aria-label="Main" ref={nav}>
          <span className="ind" aria-hidden="true" ref={ind} />
          {TABS.map(t => <NavLink key={t.to} to={t.to} end={t.end}>{t.label}</NavLink>)}
        </nav>
        {supabase && !session && <Link className="btn sm ghost" to="/welcome">Sign in</Link>}
        <button className="btn sm" onClick={openPost}><PlusIcon />Post your plate</button>
        {supabase && session && <NotificationBell key={session.user.id} />}
        <Link className="me" to={profile ? '/profile' : '/welcome'} aria-label={profile ? 'Your profile' : 'Sign in'}>
          {profile?.avatar ? <img src={profile.avatar} alt="" /> : profile ? initialsOf(profile.fullName) : <UserIcon />}
        </Link>
      </div>
    </header>
  )
}
