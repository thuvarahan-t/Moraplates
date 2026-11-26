import { useCallback, useEffect, useState } from 'react'
import { usePost } from '../lib/post'
import { useAuth } from '../lib/auth'

/**
 * Runs an async loader and reloads it when `deps` change, after any new post,
 * or when reload() is called. Keeps the old data while reloading so pages don't flash.
 */
export function useQuery(load, deps) {
  const { version } = usePost()
  const { ready } = useAuth() // wait for the session so pages don't fetch twice
  const [tick, setTick] = useState(0)
  const [state, setState] = useState({ data: undefined, error: null, loading: true })

  useEffect(() => {
    if (!ready) return
    let live = true
    setState(s => ({ ...s, loading: true }))
    load()
      .then(data => live && setState({ data, error: null, loading: false }))
      .catch(error => { console.error(error); if (live) setState({ data: undefined, error, loading: false }) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, ready, version, tick])

  const reload = useCallback(() => setTick(t => t + 1), [])
  return { ...state, reload }
}
