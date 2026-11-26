import { Fragment, useLayoutEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import Header from './components/Header'
import Footer from './components/Footer'
import BottomNav from './components/BottomNav'
import { useTilt } from './lib/useTilt'
import { PostProvider } from './lib/post'

export default function Layout() {
  const { pathname } = useLocation()
  useTilt()
  useLayoutEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <PostProvider>
      <Header />
      {/* Keyed by path so each view remounts and replays its entrance animation. */}
      <main><Fragment key={pathname}><Outlet /></Fragment></main>
      <Footer />
      <BottomNav />
    </PostProvider>
  )
}
