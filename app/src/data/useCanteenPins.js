import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { usePost } from '../lib/post'
import { useQuery } from './useQuery'

export const PIN_LIMIT = 3
const STORAGE_KEY = 'moraplates:guest-canteen-pins'
const QUERY_KEY = 'canteen-pins'

function localPins() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (Array.isArray(stored)) return [...new Set(stored.filter(id => typeof id === 'string'))].slice(0, PIN_LIMIT)
  } catch {}
  return []
}

export function useCanteenPins(canteens) {
  const { session } = useAuth()
  const { cache } = usePost()
  const account = !!(supabase && session)
  const query = useQuery(QUERY_KEY, async () => {
    const { data, error } = await supabase.from('canteen_pins').select('canteen_id')
      .eq('user_id', session.user.id).order('pinned_at').order('canteen_id')
    if (error) throw error
    return data.map(row => row.canteen_id)
  }, { enabled: account })
  const [guestPins, setGuestPins] = useState(localPins)
  const [saved, setSaved] = useState(null)
  const useSaved = saved?.cache === cache && saved.previous === query.data
  const visibleGuestPins = guestPins.filter(id => canteens.some(canteen => canteen.id === id))
  const pins = account ? (useSaved ? saved.pins : (query.data ?? [])) : visibleGuestPins

  useEffect(() => {
    const sync = event => {
      if (event.key === STORAGE_KEY || event.key === null) setGuestPins(localPins())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  async function setPin(id, pinned) {
    if (account) {
      const { data, error } = await supabase.rpc('set_canteen_pin', { target_canteen: id, pinned })
      if (error) throw error
      setSaved({ cache, pins: data, previous: query.data })
      query.reload()
      return
    }
    if (pinned && !pins.includes(id) && pins.length >= PIN_LIMIT) {
      throw new Error('You can pin up to 3 canteens. Unpin one first.')
    }
    const next = pinned ? [...new Set([...pins, id])] : pins.filter(pin => pin !== id)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
    setGuestPins(next)
  }

  return { pins, setPin, error: query.error, loading: query.loading, reload: query.reload }
}
