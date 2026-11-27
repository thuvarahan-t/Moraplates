import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useFx } from '../lib/fx'
import { usePost } from '../lib/post'
import { fetchPosts, setLike, markPostSeen, POST_READS } from './queries'
import { queryKey } from './queryCache'
import { readSeen, rememberSeen } from '../lib/seen'
import { SAMPLE_FOODS, SAMPLE_POSTS } from './sample'

// Post shape used by the UI: see fetchPosts() in queries.js.

export function samplePosts() {
  const now = Date.now()
  return SAMPLE_POSTS.map(([id, name, faculty, canteenId, foodId, rating, caption, likes, mins]) => {
    const f = SAMPLE_FOODS.find(x => x.id === foodId)
    return { id: String(id), userId: 'demo-' + name.toLowerCase().replace(/[^a-z]/g, ''), canteenId, foodId, rating, caption, createdIso: new Date(now - mins * 60_000).toISOString(), createdAt: now - mins * 60_000, author: { name, faculty }, food: { name: f.name, price: f.price }, likes, comments: 0, liked: false }
  })
}

/** Optimistic like toggle over a list of posts held in `setPosts` state. */
export function useLikeToggle(postsRef, setPosts) {
  const { toast } = useFx()
  const { session } = useAuth()
  const { cache } = usePost()
  const userId = session?.user?.id

  const pending = useRef(new Set())
  return useCallback((id, targetLiked) => {
    if (pending.current.has(id)) return false
    const p = postsRef.current?.find(x => x.id === id)
    if (!p) return false
    const liked = targetLiked ?? !p.liked
    if (liked === p.liked) return false
    if (supabase && !userId) { toast('Sign in with your @uom.lk email to like plates'); return false }

    const apply = l => setPosts(ps => ps?.map(x => (x.id === id ? { ...x, liked: l, likes: Math.max(0, x.likes + (x.liked === l ? 0 : l ? 1 : -1)) } : x)) ?? ps)
    apply(liked)
    if (supabase) {
      pending.current.add(id)
      setLike(id, userId, liked).then(() => cache.invalidate(...POST_READS)).catch(err => {
        console.error(err)
        apply(!liked)
        toast("Couldn't save your like. Try again.")
      }).finally(() => pending.current.delete(id))
    }
    return liked
  }, [cache, postsRef, setPosts, userId, toast])
}

const PAGE_SIZE = 20
const feedKey = (canteenId, past, before) => queryKey('feed', canteenId, past, before?.createdIso, before?.id)

function feedPage(rows, past, seen) {
  const posts = past ? rows : rows.filter(p => !seen.has(String(p.id)))
  return { posts, cursor: rows.length === PAGE_SIZE ? rows.at(-1) : null, past }
}

function readCachedFeed(cache, canteenId, seen) {
  if (!supabase) return null
  let cursor = null
  do {
    const rows = cache.fresh(feedKey(canteenId, false, cursor))
    if (!rows) return null
    const page = feedPage(rows, false, seen)
    if (page.posts.length) return page
    cursor = page.cursor
  } while (cursor)
  const rows = cache.fresh(feedKey(canteenId, true))
  return rows ? feedPage(rows, true, seen) : null
}

async function fetchFeedPage(cache, userId, canteenId, { past, before, seen, isCurrent }) {
  if (!supabase) {
    const posts = samplePosts().filter(p => (!canteenId || p.canteenId === canteenId) && (past || !seen.has(p.id)))
    return { posts, cursor: null, past }
  }

  let cursor = before
  do {
    const pageStart = cursor
    const rows = await cache.load(feedKey(canteenId, past, pageStart), () => fetchPosts(userId, { canteenId, unseen: !past, before: pageStart, limit: PAGE_SIZE }))
    const page = feedPage(rows, past, seen)
    if (page.posts.length || !page.cursor) return page
    cursor = page.cursor
  } while (isCurrent())
}

/** Keep current cards in place while reading, and bring back history once the fresh queue is exhausted. */
export function useFeed(canteenId) {
  const { toast } = useFx()
  const { session, ready } = useAuth()
  const { cache, version } = usePost()
  const userId = session?.user?.id
  const [refreshKey, refresh] = useState(0)
  const start = useMemo(() => {
    const seen = readSeen(userId)
    return { seen, page: ready ? readCachedFeed(cache, canteenId, seen) : null }
  }, [cache, canteenId, userId, ready, version, refreshKey])
  const [displayScope, setDisplayScope] = useState(start)
  const [posts, setPosts] = useState(start.page?.posts ?? null)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(start.page)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pageError, setPageError] = useState(false)
  const [seenCount, setSeenCount] = useState(0)
  const generation = useRef(0)
  const pending = useRef(false)
  const seen = useRef(new Set())
  const current = useRef(posts)
  const visiblePosts = displayScope === start ? posts : start.page?.posts ?? null
  current.current = visiblePosts
  useEffect(() => {
    if (!ready) return
    const run = ++generation.current
    const isCurrent = () => run === generation.current
    const options = { seen: new Set(start.seen), isCurrent }
    seen.current = options.seen
    pending.current = false
    setDisplayScope(start)
    setPosts(start.page?.posts ?? null)
    setError(null)
    setPage(start.page)
    setLoadingMore(false)
    setPageError(false)
    setSeenCount(0)

    async function load() {
      try {
        let first = await fetchFeedPage(cache, userId, canteenId, { ...options, past: false })
        if (!isCurrent()) return
        if (!first.posts.length) first = await fetchFeedPage(cache, userId, canteenId, { ...options, past: true })
        if (!isCurrent()) return
        setPosts(first.posts)
        setPage({ cursor: first.cursor, past: first.past })
      } catch (e) {
        if (!isCurrent()) return
        console.error('Feed query failed', e.code, e.message)
        setError(e)
        setPosts([])
      }
    }
    if (!start.page) load()
    return () => { generation.current++ }
  }, [cache, userId, canteenId, ready, start])

  const markSeen = useCallback(id => {
    if (seen.current.has(String(id))) return
    seen.current.add(String(id))
    setSeenCount(count => count + 1)
    rememberSeen(userId, id)
    if (supabase && userId) markPostSeen(id).catch(e => console.warn('Seen history sync failed', e.message))
  }, [userId])

  const loadMore = useCallback(async () => {
    if (displayScope !== start || !page || pending.current || (page.past && !page.cursor)) return
    const run = generation.current
    const isCurrent = () => run === generation.current
    const past = page.past || !page.cursor
    pending.current = true
    setLoadingMore(true)
    setPageError(false)
    try {
      const next = await fetchFeedPage(cache, userId, canteenId, { past, before: page.cursor, seen: seen.current, isCurrent })
      if (!isCurrent()) return
      setPosts(old => {
        if (!old) return old
        const existing = new Set(old.map(p => p.id))
        return [...old, ...next.posts.filter(p => !existing.has(p.id))]
      })
      setPage({ cursor: next.cursor, past: next.past })
      if (past && !page.past) toast("You're all caught up")
    } catch {
      if (isCurrent()) setPageError(true)
    } finally {
      if (isCurrent()) {
        pending.current = false
        setLoadingMore(false)
      }
    }
  }, [cache, canteenId, displayScope, page, start, toast, userId])

  useEffect(() => {
    if (page && !page.past && !pageError && seenCount === posts?.length) loadMore()
  }, [page, pageError, seenCount, posts?.length, loadMore])

  const toggleLike = useLikeToggle(current, setPosts)
  const visiblePage = displayScope === start ? page : start.page
  return {
    posts: visiblePosts ?? [], loading: visiblePosts === null, error: displayScope === start ? error : null,
    more: !!visiblePage?.cursor, loadingMore, pageError, caughtUp: !!visiblePage?.past, loadMore, markSeen, toggleLike,
    refresh: () => { cache.invalidate('feed'); refresh(n => n + 1) },
  }
}
