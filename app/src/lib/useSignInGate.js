import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from './auth'
import { useFx } from './fx'
import { supabase } from './supabase'

/**
 * Guests can browse everything. Call `gate('to vote')` before a write:
 * it returns true when signed in, otherwise sends them to sign in and returns false.
 */
export function useSignInGate() {
  const { session, ready } = useAuth()
  const { toast } = useFx()
  const navigate = useNavigate()
  return useCallback(why => {
    if (!supabase) { toast('Demo mode: connect Supabase to make changes.'); return false }
    if (session) return true
    if (!ready) return false // still loading the session; don't bounce a signed-in user
    toast(`Sign in with your @uom.lk email ${why}`)
    navigate('/welcome')
    return false
  }, [session, ready, toast, navigate])
}
