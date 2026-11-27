import { useCallback, useEffect, useState } from 'react'
import { usePost } from '../lib/post'
import { useAuth } from '../lib/auth'

/** Reuse recent data on navigation, and keep the last result visible during revalidation. */
export function useQuery(key, load, { enabled = true, initialData } = {}) {
  const { cache, version } = usePost()
  const { ready } = useAuth()
  const [tick, setTick] = useState(0)
  const [state, setState] = useState(null)

  useEffect(() => {
    if (!ready || !enabled) return
    let live = true
    const cached = cache.read(key)
    if (cache.fresh(key) !== undefined) {
      setState({ cache, key, data: cached })
      return
    }
    setState(previous => ({
      cache, key,
      data: cached !== undefined ? cached : (previous?.cache === cache && previous.key === key ? previous.data : undefined),
    }))
    cache.load(key, load).then(data => {
      if (live) setState({ cache, key, data })
    }).catch(error => {
      if (!live) return
      console.error(error)
      setState(previous => ({ ...previous, error }))
    })
    return () => { live = false }
    // The key describes the loader's arguments. Inline loaders need not stay referentially stable.
  }, [cache, key, enabled, ready, version, tick])

  const reload = useCallback(() => {
    cache.remove(key)
    setTick(t => t + 1)
  }, [cache, key])
  const result = state?.cache === cache && state.key === key ? state : null
  const cached = enabled ? cache.read(key) : undefined
  const data = !enabled ? initialData : (cached !== undefined ? cached : (result?.data !== undefined ? result.data : initialData))
  const error = enabled && data === undefined ? result?.error ?? null : null
  const loading = enabled && data === undefined && !error
  return { data, loading, error, reload }
}
