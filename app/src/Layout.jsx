import { Fragment, useLayoutEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import { PostProvider } from './lib/post'
import { useAuth } from './lib/auth'
import Loader from './components/Loader'

export default function Layout() {
  const { pathname } = useLocation()
  const { ready } = useAuth()
  useLayoutEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <PostProvider>
      <Header />
      {/* Keyed by path so each view remounts and replays its entrance animation. */}
      <main>{ready ? <Fragment key={pathname}><Outlet /></Fragment> : <Loader />}</main>
      <BottomNav />
    </PostProvider>
  )
}
