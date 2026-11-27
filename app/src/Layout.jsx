import { Fragment, useLayoutEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import { PostProvider } from './lib/post'
import { useAuth } from './lib/auth'
import Loader from './components/Loader'
import InstallPrompt from './components/InstallPrompt'
import HelenaChat from './components/AskMoraPlates'

export default function Layout() {
  const { pathname } = useLocation()
  const { profile, ready, session } = useAuth()
  const fullName = profile?.fullName ?? session?.user.user_metadata?.full_name
  const firstName = typeof fullName === 'string' ? fullName.trim().split(/\s+/, 1)[0] : ''
  useLayoutEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <PostProvider>
      <Header />
      {/* Keyed by path so each view remounts and replays its entrance animation. */}
      <main>{ready ? <Fragment key={pathname}><Outlet context={firstName} /></Fragment> : <Loader />}</main>
      <BottomNav />
      <InstallPrompt />
      <HelenaChat key={session?.user?.id ?? 'guest'} ready={ready} visible={pathname !== '/welcome'}
        accessToken={session?.access_token} studentId={session?.user?.id} firstName={session ? firstName : ''} />
    </PostProvider>
  )
}
