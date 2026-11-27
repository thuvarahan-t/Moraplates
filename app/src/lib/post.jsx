import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import PostDialog from '../components/PostDialog'
import { createQueryCache } from '../data/queryCache'
import { useAuth } from './auth'

const PostContext = createContext(null)

/**
 * Opens the "Post your plate" dialog from anywhere, and exposes `version`, which
 * goes up after every successful post so lists can reload.
 */
export function PostProvider({ children }) {
  const { session } = useAuth()
  const userId = session?.user?.id
  const cache = useMemo(() => createQueryCache(), [userId])
  const [request, setRequest] = useState(null) // { canteenId, foodId } while the dialog is open
  const [version, setVersion] = useState(0)

  const openPost = useCallback((canteenId, foodId) => {
    setRequest({ canteenId: typeof canteenId === 'string' ? canteenId : null, foodId: foodId ?? null })
  }, [])
  const close = useCallback(() => setRequest(null), [])
  const posted = useCallback(() => {
    cache.invalidate()
    setVersion(v => v + 1)
  }, [cache])

  const value = useMemo(() => ({ cache, openPost, version, invalidate: posted }), [cache, openPost, version, posted])
  return (
    <PostContext.Provider value={value}>
      {children}
      {request && <PostDialog request={request} onClose={close} onPosted={posted} />}
    </PostContext.Provider>
  )
}

export const usePost = () => useContext(PostContext)
