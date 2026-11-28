import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

/** The public URL works for visible photos. Storage authorizes private moderation previews. */
export default function ContentPhoto({ src, ...props }) {
  const { session, moderation } = useAuth()
  const viewerId = moderation.allowed ? session?.user?.id : null
  const [failedSrc, setFailedSrc] = useState(null)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    if (!viewerId || failedSrc !== src || !src?.startsWith('/api/photo?')) return
    const path = new URLSearchParams(src.slice(src.indexOf('?') + 1)).get('path')
    if (!path) return
    let live = true
    let url
    supabase.storage.from('photos').download(path).then(({ data, error }) => {
      if (!live || error || !data) return
      url = URL.createObjectURL(data)
      setPreview({ src, url, viewerId })
    }).catch(() => {})
    return () => {
      live = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [viewerId, failedSrc, src])

  return <img {...props} src={viewerId && preview?.viewerId === viewerId && preview.src === src ? preview.url : src}
    onError={() => { if (viewerId) setFailedSrc(src) }} />
}
