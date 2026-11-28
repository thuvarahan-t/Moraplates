import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const REFRESH_INTERVAL = 10_000

/** An opaque revision lets open tabs discard cached reads after a ban or unban. */
export function useContentVisibility() {
  const [revision, setRevision] = useState(null)

  useEffect(() => {
    if (!supabase) return
    let live = true
    let checking = false

    async function check() {
      if (checking || document.visibilityState === 'hidden') return
      checking = true
      try {
        const { data, error } = await supabase.rpc('content_visibility_version')
        if (!live || error || (typeof data !== 'number' && typeof data !== 'string')) return
        setRevision(data)
      } catch {
        // The next foreground check will retry after temporary connectivity issues.
      } finally {
        checking = false
      }
    }

    void check()
    const timer = setInterval(check, REFRESH_INTERVAL)
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      live = false
      clearInterval(timer)
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  return revision
}
