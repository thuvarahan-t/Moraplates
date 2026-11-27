import { useEffect, useRef, useState } from 'react'
import { BackIcon, LockIcon, MailIcon, PasswordPlateIcon } from './icons'
import { RESET_CODE_LENGTH, useAuth } from '../lib/auth'
import { ALLOWED_EMAIL_DOMAIN } from '../lib/supabase'

const RESEND_AFTER = 60 // Supabase allows one reset email per address per minute

/** The 8 boxes of the reset code. One real input sits on top, so paste, SMS/email autofill and backspace all just work. */
function CodeBoxes({ value, onChange, onComplete, disabled, bad }) {
  const input = useRef(null)
  useEffect(() => { input.current?.focus() }, [])
  return (
    <div className={'otp' + (bad ? ' bad' : '')} onClick={() => input.current?.focus()}>
      <input
        ref={input} className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*"
        maxLength={RESET_CODE_LENGTH} value={value} disabled={disabled} aria-label={`${RESET_CODE_LENGTH}-digit code`}
        onChange={e => {
          const v = e.target.value.replace(/\D/g, '').slice(0, RESET_CODE_LENGTH)
          onChange(v)
          if (v.length === RESET_CODE_LENGTH) onComplete(v)
        }}
      />
      {Array.from({ length: RESET_CODE_LENGTH }, (_, i) => (
        <span key={i} aria-hidden="true"
          className={'otp-box' + (value[i] ? ' on' : '') + (i === Math.min(value.length, RESET_CODE_LENGTH - 1) ? ' cur' : '')}
          style={{ '--i': i }}>
          {value[i] ?? ''}
        </span>
      ))}
    </div>
  )
}

function PasswordInput({ id, label, value, onChange, autoFocus }) {
  const [show, setShow] = useState(false)
  return (
    <div className="fl">
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input id={id} type={show ? 'text' : 'password'} autoComplete="new-password" autoCapitalize="none" spellCheck={false}
          autoFocus={autoFocus} value={value} onChange={e => onChange(e.target.value)} />
        <button type="button" aria-controls={id} aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(v => !v)}>
          <PasswordPlateIcon open={show} />
        </button>
      </div>
    </div>
  )
}

const STEPS = ['email', 'code', 'password']

/** Forgot password: email a one-time code (Supabase recovery OTP), check it, then set a new password. */
export default function ForgotPassword({ initialUser = '', onBack, onDone }) {
  const { sendResetCode, verifyResetCode, setNewPassword, endRecovery } = useAuth()
  const [step, setStep] = useState('email')
  const [user, setUser] = useState(initialUser)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)
  const [bad, setBad] = useState(0)

  useEffect(() => endRecovery, [endRecovery])

  useEffect(() => {
    if (!wait) return
    const t = setTimeout(() => setWait(w => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const email = `${user.trim().toLowerCase().split('@')[0] || 'yourname'}@${ALLOWED_EMAIL_DOMAIN}`

  const send = async e => {
    e?.preventDefault()
    if (busy || wait) return
    setBusy(true); setErr('')
    const problem = await sendResetCode(user)
    setBusy(false)
    if (problem) return setErr(problem)
    setCode('')
    setWait(RESEND_AFTER)
    setStep('code')
  }

  const verify = async value => {
    if (busy) return
    setBusy(true); setErr('')
    const problem = await verifyResetCode(user, value ?? code)
    setBusy(false)
    if (problem) { setErr(problem); setBad(b => b + 1); setCode(''); return }
    setStep('password')
  }

  const save = async e => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErr('')
    const { error, signedIn } = await setNewPassword(password, confirm)
    setBusy(false)
    if (error) return setErr(error)
    onDone(signedIn)
  }

  const at = STEPS.indexOf(step)

  return (
    <div className="auth-panel fp from-right">
      <button type="button" className="fp-back" onClick={onBack} disabled={busy}><BackIcon />Back to sign in</button>

      <ol className="fp-steps" aria-label={`Step ${at + 1} of 3`}>
        {STEPS.map((s, i) => <li key={s} className={i < at ? 'done' : i === at ? 'now' : ''} />)}
      </ol>

      {step === 'email' && (
        <form className="fp-step" key="email" noValidate onSubmit={send}>
          <span className="fp-ic"><MailIcon /></span>
          <div className="auth-head">
            <h2>Forgot your password?</h2>
            <p>No worries. We'll email {RESET_CODE_LENGTH === 8 ? 'an' : 'a'} {RESET_CODE_LENGTH}-digit code to your university address.</p>
          </div>
          <label className="fl">
            <span>University email</span>
            <span className="mailbox">
              <input autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="yourname.23" value={user} autoFocus
                onChange={e => { setUser(e.target.value.replace(/@.*/, '')); setErr('') }} />
              <span aria-hidden="true">@{ALLOWED_EMAIL_DOMAIN}</span>
            </span>
          </label>
          <p className="err" role="alert">{err}</p>
          <button className="btn wide" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
        </form>
      )}

      {step === 'code' && (
        <form className="fp-step" key="code" noValidate onSubmit={e => { e.preventDefault(); verify() }}>
          <span className="fp-ic"><MailIcon /></span>
          <div className="auth-head">
            <h2>Check your inbox</h2>
            <p>Enter the code we sent to <b className="fp-mail">{email}</b>. It works for one hour.</p>
          </div>
          <CodeBoxes key={bad} value={code} bad={bad > 0} disabled={busy}
            onChange={v => { setCode(v); setErr('') }} onComplete={verify} />
          <p className="err" role="alert">{err}</p>
          <button className="btn wide" type="submit" disabled={busy || code.length !== RESET_CODE_LENGTH}>
            {busy ? 'Checking…' : 'Verify code'}
          </button>
          <p className="wl-note">
            Didn't get it? Check spam, or{' '}
            {wait
              ? <span className="fp-wait">send again in {wait}s</span>
              : <button type="button" className="linkbtn" onClick={send} disabled={busy}>send a new code</button>}
            {' · '}
            <button type="button" className="linkbtn" onClick={() => { setStep('email'); setErr('') }}>change email</button>
          </p>
        </form>
      )}

      {step === 'password' && (
        <form className="fp-step" key="password" noValidate onSubmit={save}>
          <span className="fp-ic ok"><LockIcon /></span>
          <div className="auth-head">
            <h2>Choose a new password</h2>
            <p>Code accepted. Pick a new password for <b className="fp-mail">{email}</b>.</p>
          </div>
          {/* lets password managers save the new password against the right account */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          <PasswordInput id="fp-new" label={<>New password <em>at least 6 characters</em></>} value={password} autoFocus
            onChange={v => { setPassword(v); setErr('') }} />
          <PasswordInput id="fp-confirm" label="Type it again" value={confirm} onChange={v => { setConfirm(v); setErr('') }} />
          <p className="err" role="alert">{err}</p>
          <button className="btn wide" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save password and sign in'}</button>
        </form>
      )}
    </div>
  )
}
