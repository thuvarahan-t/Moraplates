import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import PostDialog from '../components/PostDialog'
import { createQueryCache } from '../data/queryCache'
import { friendly, setProfileFollow } from '../data/queries'
import { useAuth } from './auth'
import { useContentVisibility } from './useContentVisibility'
import { useFx } from './fx'

const PostContext = createContext(null)
const noFollowChanges = new Map()

function useFollowChanges(cache, userId) {
  const { toast } = useFx()
  const [saved, setSaved] = useState(null)
  const activeCache = useRef(cache)
  activeCache.current = cache
  const pending = useMemo(() => new Set(), [cache])
  const changes = saved?.cache === cache ? saved.changes : noFollowChanges

  const changeFollow = useCallback(async (targetId, following, previous) => {
    if (!userId || !targetId || userId === targetId || pending.has(targetId)) return false

    const apply = entry => {
      if (activeCache.current !== cache) return
      setSaved(current => {
        const next = new Map(current?.cache === cache ? current.changes : noFollowChanges)
        if (entry) next.set(targetId, entry)
        else next.delete(targetId)
        return { cache, changes: next }
      })
    }

    pending.add(targetId)
    apply({ following, pending: true })
    try {
      await setProfileFollow(targetId, userId, following)
      cache.invalidate('feed', 'profile-follows')
      apply({ following, completedAt: Date.now() })
      return activeCache.current === cache
    } catch (error) {
      apply(previous)
      if (activeCache.current === cache) toast(friendly(error))
      return false
    } finally {
      pending.delete(targetId)
    }
  }, [cache, pending, toast, userId])

  return { followChanges: changes, changeFollow }
}

/**
 * Opens the plate composer or editor and reloads lists after successful changes.
 */
export function PostProvider({ children }) {
  const { session } = useAuth()
  const userId = session?.user?.id
  const visibilityRevision = useContentVisibility()
  const cache = useMemo(() => createQueryCache(), [userId, visibilityRevision])
  const pendingLikes = useMemo(() => new Map(), [userId])
  const { followChanges, changeFollow } = useFollowChanges(cache, userId)
  const [request, setRequest] = useState(null)
  const [version, setVersion] = useState(0)
  const [feedVersion, setFeedVersion] = useState(0)

  const openPost = useCallback((canteenId, foodId) => {
    setRequest({ canteenId: typeof canteenId === 'string' ? canteenId : null, foodId: foodId ?? null })
  }, [])
  const openPostEdit = useCallback(post => {
    if (userId && post.userId === userId) setRequest({ canteenId: post.canteenId, foodId: post.foodId, post })
  }, [userId])
  const close = useCallback(() => setRequest(null), [])
  const posted = useCallback(() => {
    cache.invalidate()
    setVersion(v => v + 1)
  }, [cache])
  const refreshFeed = useCallback(() => {
    cache.invalidate('feed')
    setFeedVersion(v => v + 1)
  }, [cache])

  const value = useMemo(() => ({ cache, pendingLikes, followChanges, changeFollow, openPost, openPostEdit, version, feedVersion, refreshFeed, invalidate: posted }),
    [cache, pendingLikes, followChanges, changeFollow, openPost, openPostEdit, version, feedVersion, refreshFeed, posted])
  return (
    <PostContext.Provider value={value}>
      {children}
      {request && <PostDialog request={request} onClose={close} onPosted={posted} />}
    </PostContext.Provider>
  )
}

export const usePost = () => useContext(PostContext)

export function useFollowAction(targetId, initialFollowing, followingReadAt = 0) {
  const { followChanges, changeFollow } = usePost()
  const entry = followChanges.get(targetId)
  // A pending write beats a stale read. A read started after completion gets the latest status.
  const override = entry && (entry.pending || entry.completedAt >= followingReadAt) ? entry : undefined
  const following = override?.following ?? initialFollowing
  return {
    following,
    pending: entry?.pending === true,
    setFollowing: next => next !== following ? changeFollow(targetId, next, override) : Promise.resolve(false),
  }
}
