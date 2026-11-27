import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ALLOWED_EMAIL_DOMAIN, supabase } from './supabase'
import { SAMPLE_ME } from '../data/sample'
import { photoUrl } from './photos'

const AuthContext = createContext(null)

const toProfile = r => r && { id: r.id, fullName: r.full_name, faculty: r.faculty, batch: r.batch, avatarPath: r.avatar_path, avatar: photoUrl(r.avatar_path) }

export const initialsOf = name =>
  name.split(/[\s.]+/).filter(w => /^[a-z]/i.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'

/** "thuvarahant.23" (or a pasted full address) -> "thuvarahant.23@uom.lk", or null if it isn't a valid name. */
export function universityEmail(input) {
  const user = input.trim().toLowerCase().split('@')[0]
  return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(user) ? `${user}@${ALLOWED_EMAIL_DOMAIN}` : null
}

/** Supabase auth errors in plain words. */
function authMessage(e) {
  const m = e?.message ?? ''
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password.'
  if (/email not confirmed/i.test(m)) return 'This account is waiting for email confirmation. Ask the admin to confirm it in Supabase.'
  if (/already registered|already exists/i.test(m)) return 'That email already has an account. Sign in instead.'
  if (/password/i.test(m)) return m
  if (/rate limit/i.test(m)) return 'Too many tries. Wait a minute and try again.'
  return m || 'Something went wrong. Try again.'
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loadedProfile, setProfile] = useState(supabase ? null : SAMPLE_ME)
  const [ready, setReady] = useState(!supabase)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id
  const profile = supabase && loadedProfile?.id !== userId ? null : loadedProfile
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

  const value = useMemo(() => ({
    ready,
    session,
    profile,
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
    async signOut() {
      if (supabase) await supabase.auth.signOut()
    },
  }), [ready, session, profile, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
