import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchHome, sampleHome } from './api'
import { useFx } from '../lib/fx'
import { usePost } from '../lib/post'

const EMPTY = { canteens: [], foods: [], platesToday: 0 }

/** Sample mode resolves synchronously so the first paint matches index.html exactly. */
export function useHomeData() {
  const { toast } = useFx()
  const { version } = usePost()
  const [data, setData] = useState(() => (supabase ? null : sampleHome()))

  useEffect(() => {
    if (!supabase) return
    let live = true
    fetchHome()
      .then(d => live && setData(d))
      .catch(err => {
        console.error(err)
        if (live) { setData(EMPTY); toast("Couldn't load canteens. Check your connection.") }
      })
    return () => { live = false }
  }, [toast, version])

  return { data: data ?? EMPTY, loading: data === null }
}
