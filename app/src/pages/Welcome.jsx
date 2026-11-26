import { useRef, useState } from 'react'
import { Navigate } from 'react-router'
import { Link } from '../components/NavLinks'
import PlateScene from '../components/PlateScene'
import { CameraIcon, ChefHatIcon, ForkKnifeIcon, SparkIcon, TrophyIcon } from '../components/icons'
import { useAuth } from '../lib/auth'
import { useFx } from '../lib/fx'
import { ALLOWED_EMAIL_DOMAIN } from '../lib/supabase'

const POINTS = [
  [SparkIcon, 'var(--ab)', 'var(--at)', "See what's good today", 'Real plates from real students, right now.'],
  [TrophyIcon, 'var(--ob)', 'var(--ot)', 'Vote your favourite canteen', 'One vote each. Change it anytime.'],
  [CameraIcon, 'var(--sb)', 'var(--st)', 'Post your plate', 'Snap it, rate it, done in three taps.'],
]

const TABS = [
  { id: 'in', label: 'Sign in', Icon: ForkKnifeIcon, title: 'Welcome back', sub: "Your plate's still warm. Sign in to post, vote and comment." },
  { id: 'up', label: 'Create account', Icon: ChefHatIcon, title: 'Pull up a chair', sub: 'New here? Set your plate at the table. It takes 20 seconds.' },
]

/** Sign in / Create account tabs with a @uom.lk email and a password (Welcome design). */
export default function Welcome() {
  const { session, signIn, signUp } = useAuth()
  const { toast } = useFx()
  const [mode, setMode] = useState('in')
  const [from, setFrom] = useState('left') // which side the new panel slides in from
  const [name, setName] = useState('')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const tabRefs = useRef({})

  if (session) return <Navigate to="/" replace />

  const up = mode === 'up'
  const tab = TABS.find(t => t.id === mode)

  const switchTo = (m, focus = false) => {
    if (m === mode) return
    setFrom(m === 'up' ? 'right' : 'left')
    setMode(m)
    setErr('')
    if (focus) tabRefs.current[m]?.focus()
  }

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onTabKey = e => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      e.preventDefault()
      const next = e.key === 'Home' ? 'in' : e.key === 'End' ? 'up' : mode === 'in' ? 'up' : 'in'
      switchTo(next, true)
    }
  }

  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    const problem = up ? await signUp(user, password, name) : await signIn(user, password)
    setBusy(false)
    if (problem) {
      setErr(problem)
      if (up && /already has an account/.test(problem)) switchTo('in') // keep what they typed, just switch tabs
    } else toast(up ? 'Your seat is ready. Welcome to MoraPlates!' : 'Welcome back! Your plate is warm.')
  }

  return (
    <section className="view"><div className="band">
      <div className="welcome">
        <div className="wl-top">
          {/* key: the "new plate" intro replays every time Create account opens */}
          <PlateScene key={mode} intro={up} />
          <div className="wl-word"><span>Mora</span>Plates</div>
          <p className="wl-tag">Rate it. Vote it. Eat it.</p>
        </div>

        <div className="card auth">
          <div className="auth-tabs" role="tablist" aria-label="Sign in or create an account" data-mode={mode}>
            <span className="auth-ind" aria-hidden="true" />
            {TABS.map(t => (
              <button
                key={t.id} type="button" role="tab" id={`tab-${t.id}`} ref={el => { tabRefs.current[t.id] = el }}
                aria-selected={mode === t.id} aria-controls="auth-panel" tabIndex={mode === t.id ? 0 : -1}
                onClick={() => switchTo(t.id)} onKeyDown={onTabKey}
              >
                <span className="auth-ic" key={mode === t.id ? 'on' : 'off'}><t.Icon /></span>{t.label}
              </button>
            ))}
          </div>

          <form
            key={mode} id="auth-panel" role="tabpanel" aria-labelledby={`tab-${mode}`}
            className={'auth-panel from-' + from} noValidate onSubmit={submit}
          >
            <div className="auth-head">
              <h2>{tab.title}</h2>
              <p>{tab.sub}</p>
            </div>

            {up && (
              <label className="fl">
                <span>Your name</span>
                <input autoComplete="name" maxLength={60} placeholder="Thuvarahan T" value={name} onChange={e => { setName(e.target.value); setErr('') }} />
              </label>
            )}
            <label className="fl">
              <span>University email</span>
              <span className="mailbox">
                <input autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="yourname.23" value={user}
                  onChange={e => { setUser(e.target.value.replace(/@.*/, '')); setErr('') }} />
                <span aria-hidden="true">@{ALLOWED_EMAIL_DOMAIN}</span>
              </span>
            </label>
            <label className="fl">
              <span>Password {up && <em>at least 6 characters</em>}</span>
              <input type="password" autoComplete={up ? 'new-password' : 'current-password'} value={password}
                onChange={e => { setPassword(e.target.value); setErr('') }} />
            </label>

            <p className="err" role="alert">{err}</p>
            <button className="btn wide" type="submit" disabled={busy}>
              {busy ? (up ? 'Setting your plate…' : 'Warming your plate…') : up ? 'Create account' : 'Sign in'}
            </button>
            <p className="wl-note">
              {up ? 'Already have an account? ' : 'New to MoraPlates? '}
              <button type="button" className="linkbtn" onClick={() => switchTo(up ? 'in' : 'up', true)}>{up ? 'Sign in' : 'Create one'}</button>
            </p>
          </form>
        </div>

        <Link className="wl-alt" to="/">Continue as guest</Link>
        <p className="wl-note" style={{ marginTop: -18 }}>Join with your @{ALLOWED_EMAIL_DOMAIN} university email.</p>

        <div className="wl-cards">
          {POINTS.map(([Icon, bg, fg, title, sub], i) => (
            <div key={title} className="card wl-card rise" style={{ '--i': i }}>
              <span className="si" style={{ background: bg, color: fg }}><Icon size={22} /></span>
              <div><b>{title}</b><small>{sub}</small></div>
            </div>
          ))}
        </div>
      </div>
    </div></section>
  )
}
