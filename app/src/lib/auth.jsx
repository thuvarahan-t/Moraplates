import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ALLOWED_EMAIL_DOMAIN, createRecoveryClient, supabase } from './supabase'
import { SAMPLE_ME } from '../data/sample'
import { photoUrl } from './photos'
import { checkModeration } from '../data/admin'
import { useFx } from './fx'

const AuthContext = createContext(null)
const noModeration = { allowed: false }
const BANNED_MESSAGE = 'This account has been banned from MoraPlates.'
const ACCESS_CHECK_INTERVAL = 15_000

const toProfile = r => r && { id: r.id, fullName: r.full_name, faculty: r.faculty, batch: r.batch, avatarPath: r.avatar_path, avatar: photoUrl(r.avatar_path) }

export const initialsOf = name =>
  name.split(/[\s.]+/).filter(w => /^[a-z]/i.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'

/** "thuvarahant.23" (or a pasted full address) -> "thuvarahant.23@uom.lk", or null if it isn't a valid name. */
export function universityEmail(input) {
  const user = input.trim().toLowerCase().split('@')[0]
  return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(user) ? `${user}@${ALLOWED_EMAIL_DOMAIN}` : null
}

/** Digits in the password reset code. Must match Supabase → Authentication → Email → "Email OTP length". */
export const RESET_CODE_LENGTH = 8

/** Supabase auth errors in plain words. */
function authMessage(e) {
  const m = e?.message ?? ''
  if (e?.code === 'user_banned' || /user is banned|account (is|has been) banned/i.test(m)) return BANNED_MESSAGE
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password.'
  if (/email not confirmed/i.test(m)) return 'This account is waiting for email confirmation. Ask the admin to confirm it in Supabase.'
  if (/already registered|already exists/i.test(m)) return 'That email already has an account. Sign in instead.'
  if (/different from the old password/i.test(m)) return 'Choose a password that is different from your old one.'
  if (/password/i.test(m)) return m
  if (/rate limit|security purposes|only request this after/i.test(m)) return 'Too many tries. Wait a minute and try again.'
  if (/token.*(expired|invalid)|otp.*(expired|invalid)/i.test(m)) return "That code is wrong or has expired. Check the email, or send a new code."
  return m || 'Something went wrong. Try again.'
}

export function AuthProvider({ children }) {
  const { toast } = useFx()
  const [storedSession, setStoredSession] = useState(null)
  const [checkedUserId, setCheckedUserId] = useState(null)
  const [loadedProfile, setProfile] = useState(supabase ? null : SAMPLE_ME)
  const [sessionReady, setSessionReady] = useState(!supabase)
  const [tick, setTick] = useState(0)
  const [moderation, setModeration] = useState(null)
  const recovery = useRef(null)
  const currentAccessToken = useRef(null)
  const storeSession = useCallback(next => {
    currentAccessToken.current = next?.access_token ?? null
    setStoredSession(next)
    if (!next) setCheckedUserId(null)
  }, [])

  useEffect(() => {
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      storeSession(next)
      setSessionReady(true)
    })
    return () => subscription.unsubscribe()
  }, [storeSession])

  const storedUserId = storedSession?.user?.id
  const accessToken = storedSession?.access_token
  const ready = sessionReady && (!storedUserId || checkedUserId === storedUserId)
  const session = ready ? storedSession : null
  useEffect(() => {
    if (!storedUserId || !accessToken) return
    let live = true
    let checking = false

    async function checkAccess() {
      if (checking || document.visibilityState === 'hidden') return
      checking = true
      try {
        const { data, error } = await supabase.rpc('account_access_status')
        if (!live || currentAccessToken.current !== accessToken) return
        const banned = data === 'banned' || error?.code === 'PT403'
        if (banned || data === 'signed_out' || error?.code === 'PT401') {
          storeSession(null)
          toast(banned ? BANNED_MESSAGE : 'Your session ended. Sign in again.')
          void supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        }
      } catch {
        // Keep the next foreground check available during temporary network errors.
      } finally {
        if (live && currentAccessToken.current === accessToken) setCheckedUserId(storedUserId)
        checking = false
      }
    }

    void checkAccess()
    const timer = setInterval(checkAccess, ACCESS_CHECK_INTERVAL)
    document.addEventListener('visibilitychange', checkAccess)
    window.addEventListener('focus', checkAccess)
    window.addEventListener('online', checkAccess)
    return () => {
      live = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', checkAccess)
      window.removeEventListener('focus', checkAccess)
      window.removeEventListener('online', checkAccess)
    }
  }, [storedUserId, accessToken, storeSession, toast])

  const userId = session?.user?.id
  const profile = supabase && loadedProfile?.id !== userId ? null : loadedProfile
  const currentModeration = moderation && moderation.userId === userId ? moderation : noModeration
  useEffect(() => {
    setModeration(null)
    if (!userId) return
    let live = true
    checkModeration().then(allowed => {
      if (live) setModeration({ userId, allowed: allowed === true })
    }).catch(() => {})
    return () => { live = false }
  }, [userId])

  useEffect(() => {
    if (!supabase) return
    if (!userId) { setProfile(null); return }
    let live = true
    supabase.from('profiles').select('*').eq('id', userId).single()
      .then(({ data, error }) => {
        if (error) console.error(error)
        if (live) setProfile(toProfile(data))
      })
    return () => { live = false }
  }, [userId, tick])

  const refreshProfile = useCallback(() => setTick(t => t + 1), [])
  const endRecovery = useCallback(() => { recovery.current = null }, [])

  const value = useMemo(() => ({
    ready,
    session,
    profile,
    moderation: currentModeration,
    refreshProfile,
    /** Email + password sign-in. Returns an error message, or null on success. */
    async signIn(username, password) {
      const email = universityEmail(username)
      if (!email) return 'Enter the first part of your university email, like yourname.23'
      if (!password) return 'Enter your password.'
      if (!supabase) return 'Sign-in needs a Supabase project. Add keys to .env.'
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return error ? authMessage(error) : null
    },
    /** Creates an account and signs straight in (needs "Confirm email" off in Supabase). */
    async signUp(username, password, fullName) {
      const email = universityEmail(username)
      if (!fullName.trim()) return 'Enter your name.'
      if (!email) return 'Enter the first part of your university email, like yourname.23'
      if (password.length < 6) return 'Use at least 6 characters for your password.'
      if (!supabase) return 'Sign-up needs a Supabase project. Add keys to .env.'
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName.trim() } } })
      if (error) return authMessage(error)
      if (!data.session) return 'Account created, but Supabase is asking for email confirmation. Turn off "Confirm email" in Supabase, then sign in.'
      return null
    },
    endRecovery,
    /** Forgot password, step 1: email a one-time code. Says nothing about whether the account exists. */
    async sendResetCode(username) {
      const email = universityEmail(username)
      if (!email) return 'Enter the first part of your university email, like yourname.23'
      if (!supabase) return 'Password reset needs a Supabase project. Add keys to .env.'
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      return error ? authMessage(error) : null
    },
    /** Step 2: check the code in a client used only for this reset. */
    async verifyResetCode(username, code) {
      const email = universityEmail(username)
      const token = (code ?? '').replace(/\D/g, '')
      if (!email) return 'Enter the first part of your university email, like yourname.23'
      if (token.length !== RESET_CODE_LENGTH) return `Enter the ${RESET_CODE_LENGTH}-digit code from the email.`
      if (!supabase) return 'Password reset needs a Supabase project. Add keys to .env.'
      const client = createRecoveryClient()
      recovery.current = client
      try {
        const { data, error } = await client.auth.verifyOtp({ email, token, type: 'recovery' })
        if (error) throw error
        if (data.session && recovery.current === client) return null
        if (recovery.current === client) endRecovery()
        return 'Start a new password reset to continue.'
      } catch (error) {
        if (recovery.current === client) endRecovery()
        return authMessage(error)
      }
    },
    /** Step 3: save the password, then sign in to the app. */
    async setNewPassword(password, confirm) {
      if (password.length < 6) return { error: 'Use at least 6 characters for your password.' }
      if (password !== confirm) return { error: "The two passwords don't match." }
      const client = recovery.current
      if (!client) return { error: 'Start a new password reset to continue.' }

      try {
        const { error } = await client.auth.updateUser({ password })
        if (error) return { error: authMessage(error) }
      } catch (error) {
        return { error: authMessage(error) }
      }

      try {
        const { data } = await client.auth.getSession()
        if (!data.session || recovery.current !== client) return { signedIn: false }
        const { access_token, refresh_token } = data.session
        const result = await supabase.auth.setSession({ access_token, refresh_token })
        return { signedIn: !!result.data.session }
      } catch {
        return { signedIn: false }
      } finally {
        if (recovery.current === client) endRecovery()
      }
    },
    async signOut() {
      if (supabase) await supabase.auth.signOut()
    },
  }), [ready, session, profile, currentModeration, refreshProfile, endRecovery])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
export const useModeration = () => useAuth().moderation
