import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useFx } from '../lib/fx'
import { usePost } from '../lib/post'
import { fetchPosts, setLike } from './queries'
import { SAMPLE_FOODS, SAMPLE_POSTS } from './sample'

// Post shape used by the UI: see fetchPosts() in queries.js.

function samplePosts() {
  const now = Date.now()
  return SAMPLE_POSTS.map(([id, name, faculty, canteenId, foodId, rating, caption, likes, mins]) => {
    const f = SAMPLE_FOODS.find(x => x.id === foodId)
    return { id, canteenId, rating, caption, createdAt: now - mins * 60_000, author: { name, faculty }, food: { name: f.name, price: f.price }, likes, comments: 0, liked: false }
  })
}

/** Optimistic like toggle over a list of posts held in `setPosts` state. */
export function useLikeToggle(postsRef, setPosts) {
  const { toast } = useFx()
  const { session } = useAuth()
  const userId = session?.user?.id

  return useCallback(id => {
    const p = postsRef.current?.find(x => x.id === id)
    if (!p) return false
    if (supabase && !userId) { toast('Sign in with your @uom.lk email to like plates'); return false }

    const liked = !p.liked
    const apply = l => setPosts(ps => ps.map(x => (x.id === id ? { ...x, liked: l, likes: x.likes + (l ? 1 : -1) } : x)))
    apply(liked)
    if (supabase) {
      setLike(id, userId, liked).catch(err => {
        console.error(err)
        apply(!liked)
        toast("Couldn't save your like. Try again.")
      })
    }
    return liked
  }, [postsRef, setPosts, userId, toast])
}

/** Latest posts for the feed. Sample mode keeps likes in memory. */
export function useFeed() {
  const { toast } = useFx()
  const { session, ready } = useAuth()
  const { version } = usePost()
  const userId = session?.user?.id
  const [posts, setPosts] = useState(() => (supabase ? null : samplePosts()))
  const current = useRef(posts)
  current.current = posts

  useEffect(() => {
    if (!supabase || !ready) return
    let live = true
    fetchPosts(userId)
      .then(p => live && setPosts(p))
      .catch(err => {
        console.error(err)
        if (live) { setPosts([]); toast("Couldn't load the feed. Check your connection.") }
      })
    return () => { live = false }
  }, [userId, ready, toast, version])

  const toggleLike = useLikeToggle(current, setPosts)
  return { posts: posts ?? [], loading: posts === null, toggleLike }
}
