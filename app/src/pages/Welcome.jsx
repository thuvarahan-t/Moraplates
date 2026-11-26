import { useState } from 'react'
import { Navigate } from 'react-router'
import { Link } from '../components/NavLinks'
import { CameraIcon, SparkIcon, TrophyIcon } from '../components/icons'
import { useAuth } from '../lib/auth'
import { useFx } from '../lib/fx'
import { ALLOWED_EMAIL_DOMAIN } from '../lib/supabase'

const POINTS = [
  [SparkIcon, 'var(--ab)', 'var(--at)', "See what's good today", 'Real plates from real students, right now.'],
  [TrophyIcon, 'var(--ob)', 'var(--ot)', 'Vote your favourite canteen', 'One vote each. Change it anytime.'],
  [CameraIcon, 'var(--sb)', 'var(--st)', 'Post your plate', 'Snap it, rate it, done in three taps.'],
]

/** Sign in / create account with a @uom.lk email and a password (Welcome design). */
export default function Welcome() {
  const { session, signIn, signUp } = useAuth()
  const { toast } = useFx()
  const [mode, setMode] = useState('in') // 'in' | 'up'
  const [name, setName] = useState('')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  const up = mode === 'up'
  const switchTo = m => { setMode(m); setErr('') }

  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    const problem = up ? await signUp(user, password, name) : await signIn(user, password)
    setBusy(false)
    if (problem) {
      setErr(problem)
      if (up && /already has an account/.test(problem)) setMode('in') // keep their email + password, just switch tabs
    } else toast(up ? 'Welcome to MoraPlates!' : 'Signed in')
  }

  return (
    <section className="view"><div className="band">
      <div className="welcome">
        <div className="wl-top">
          <svg className="wl-mark" aria-hidden="true"><use href="#mark" /></svg>
          <div className="wl-word"><span>Mora</span>Plates</div>
          <p className="wl-tag">Rate it. Vote it. Eat it.</p>
        </div>

        <div className="wl-cards">
          {POINTS.map(([Icon, bg, fg, title, sub], i) => (
            <div key={title} className="card wl-card rise" style={{ '--i': i }}>
              <span className="si" style={{ background: bg, color: fg }}><Icon size={22} /></span>
              <div><b>{title}</b><small>{sub}</small></div>
            </div>
          ))}
        </div>

        <form className="wl-form" noValidate onSubmit={submit}>
          <div className="seg wl-tabs" role="tablist">
            <label><input type="radio" name="mode" checked={!up} onChange={() => switchTo('in')} /><span>Sign in</span></label>
            <label><input type="radio" name="mode" checked={up} onChange={() => switchTo('up')} /><span>Create account</span></label>
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
            {busy ? 'Please wait…' : up ? 'Create account' : 'Sign in'}
          </button>
          <p className="wl-note">Only @{ALLOWED_EMAIL_DOMAIN} accounts, so every vote is a real student.</p>
          <Link className="wl-alt" to="/">Continue as guest</Link>
        </form>
      </div>
    </div></section>
  )
}
