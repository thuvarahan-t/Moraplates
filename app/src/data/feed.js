import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useFx } from '../lib/fx'
import { usePost } from '../lib/post'
import { fetchPosts, setLike, markPostSeen } from './queries'
import { readSeen, rememberSeen } from '../lib/seen'
import { SAMPLE_FOODS, SAMPLE_POSTS } from './sample'

// Post shape used by the UI: see fetchPosts() in queries.js.

export function samplePosts() {
  const now = Date.now()
  return SAMPLE_POSTS.map(([id, name, faculty, canteenId, foodId, rating, caption, likes, mins]) => {
    const f = SAMPLE_FOODS.find(x => x.id === foodId)
    return { id: String(id), userId: 'demo-' + name.toLowerCase().replace(/[^a-z]/g, ''), canteenId, rating, caption, createdIso: new Date(now - mins * 60_000).toISOString(), createdAt: now - mins * 60_000, author: { name, faculty }, food: { name: f.name, price: f.price }, likes, comments: 0, liked: false }
  })
}

/** Optimistic like toggle over a list of posts held in `setPosts` state. */
export function useLikeToggle(postsRef, setPosts) {
  const { toast } = useFx()
  const { session } = useAuth()
  const userId = session?.user?.id

  const pending = useRef(new Set())
  return useCallback(id => {
    if (pending.current.has(id)) return false
    const p = postsRef.current?.find(x => x.id === id)
    if (!p) return false
    if (supabase && !userId) { toast('Sign in with your @uom.lk email to like plates'); return false }

    const liked = !p.liked
    const apply = l => setPosts(ps => ps?.map(x => (x.id === id ? { ...x, liked: l, likes: Math.max(0, x.likes + (x.liked === l ? 0 : l ? 1 : -1)) } : x)) ?? ps)
    apply(liked)
    if (supabase) {
      pending.current.add(id)
      setLike(id, userId, liked).catch(err => {
        console.error(err)
        apply(!liked)
        toast("Couldn't save your like. Try again.")
      }).finally(() => pending.current.delete(id))
    }
    return liked
  }, [postsRef, setPosts, userId, toast])
}

/** Viewed cards remain until refresh. Signed-in history is also saved server-side. */
export function useFeed() {
  const { toast } = useFx()
  const { session, ready } = useAuth()
  const { version } = usePost()
  const userId = session?.user?.id
  const [posts, setPosts] = useState(null)
  const [refreshKey, refresh] = useState(0)
  const [error, setError] = useState(null)
  const [more, setMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cursor, setCursor] = useState(null)
  const generation = useRef(0)
  const initialSeen = useRef(new Set())
  const recorded = useRef(new Set())
  const current = useRef(posts)
  current.current = posts
  useEffect(() => {
    if (!ready) return
    const run = ++generation.current
    initialSeen.current = readSeen(userId)
    recorded.current = new Set()
    setPosts(null); setError(null); setMore(false); setCursor(null); setLoadingMore(false)
    const load = supabase ? fetchPosts(userId, { unseen: true, limit: 20 }) : Promise.resolve(samplePosts())
    load.then(rows => {
      if (run !== generation.current) return
      setPosts(rows.filter(p => !initialSeen.current.has(String(p.id))))
      setCursor(rows.at(-1) ?? null); setMore(!!supabase && rows.length === 20)
    }).catch(e => { if (run === generation.current) { setError(e); setPosts([]) } })
    return () => { generation.current++ }
  }, [userId, ready, version, refreshKey])
  const markSeen = useCallback(id => {
    if (recorded.current.has(id)) return
    recorded.current.add(id)
    rememberSeen(userId, id)
    if (supabase && userId) markPostSeen(id).catch(e => console.warn('Seen history sync failed', e.message))
  }, [userId])
  const loadMore = async () => {
    if (!supabase || !more || loadingMore || !cursor) return
    const run = generation.current
    setLoadingMore(true)
    try {
      const rows = await fetchPosts(userId, { unseen: true, before: cursor, limit: 20 })
      if (run !== generation.current) return
      setPosts(old => [...old, ...rows.filter(p => !initialSeen.current.has(String(p.id)) && !old.some(x => x.id === p.id))])
      setCursor(rows.at(-1) ?? null); setMore(rows.length === 20)
    } catch { if (run === generation.current) toast("Couldn't load more plates.") }
    finally { if (run === generation.current) setLoadingMore(false) }
  }
  const toggleLike = useLikeToggle(current, setPosts)
  return { posts: posts ?? [], loading: posts === null, error, more, loadingMore, loadMore, markSeen, toggleLike, refresh: () => refresh(n => n + 1) }
}
