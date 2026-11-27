import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchHome, sampleHome } from './api'
import { useFx } from '../lib/fx'
import { usePost } from '../lib/post'
import { useQuery } from './useQuery'

const EMPTY = { canteens: [], foods: [], platesToday: 0 }
const SAMPLE = sampleHome()

/** Sample mode resolves synchronously so the first paint matches index.html exactly. */
export function useHomeData() {
  const { toast } = useFx()
  const { cache } = usePost()
  const { data, loading, error } = useQuery('home', () => fetchHome(cache), {
    enabled: !!supabase,
    initialData: supabase ? undefined : SAMPLE,
  })

  useEffect(() => {
    if (error) toast("Couldn't load canteens. Check your connection.")
  }, [error, toast])

  return { data: data ?? EMPTY, loading }
}
