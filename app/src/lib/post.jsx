import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import PostDialog from '../components/PostDialog'

const PostContext = createContext(null)

/**
 * Opens the "Post your plate" dialog from anywhere, and exposes `version`, which
 * goes up after every successful post so lists can reload.
 */
export function PostProvider({ children }) {
  const [request, setRequest] = useState(null) // { canteenId, foodId } while the dialog is open
  const [version, setVersion] = useState(0)

  const openPost = useCallback((canteenId, foodId) => {
    setRequest({ canteenId: typeof canteenId === 'string' ? canteenId : null, foodId: foodId ?? null })
  }, [])
  const close = useCallback(() => setRequest(null), [])
  const posted = useCallback(() => setVersion(v => v + 1), [])

  const value = useMemo(() => ({ openPost, version, invalidate: posted }), [openPost, version, posted])
  return (
    <PostContext.Provider value={value}>
      {children}
      {request && <PostDialog request={request} onClose={close} onPosted={posted} />}
    </PostContext.Provider>
  )
}

export const usePost = () => useContext(PostContext)
