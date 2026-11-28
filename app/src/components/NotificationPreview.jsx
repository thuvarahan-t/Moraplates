import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell } from 'lucide-react'
import { notificationCopy, notificationDestination } from '../data/notifications'
import { Link } from './NavLinks'

const PREVIEW_DURATION = 3400

export default function NotificationPreview({ latest, open, markRead }) {
  const newestSeen = useRef(null)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    if (latest === undefined) return
    if (newestSeen.current === null) {
      newestSeen.current = latest?.id ?? 0
      return
    }
    if (!latest || latest.id <= newestSeen.current) return
    newestSeen.current = latest.id
    if (!open && document.visibilityState === 'visible') setPreview(latest)
  }, [latest, open])

  useEffect(() => {
    if (!preview) return
    const dismiss = () => setPreview(null)
    const timer = window.setTimeout(dismiss, PREVIEW_DURATION)
    function dismissWhenHidden() {
      if (document.visibilityState !== 'visible') dismiss()
    }
    document.addEventListener('visibilitychange', dismissWhenHidden)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', dismissWhenHidden)
    }
  }, [preview])

  useEffect(() => {
    if (open) setPreview(null)
  }, [open])

  return createPortal(
    <div className="notification-preview-region" aria-live="polite" aria-atomic="true">
      {preview && !open && (
        <Link key={preview.id} className="notification-preview" to={notificationDestination(preview)} viewTransition={false}
          style={{ '--notification-preview-duration': `${PREVIEW_DURATION}ms` }}
          onClick={event => {
            if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
            void markRead(preview.id)
            setPreview(null)
          }}>
          <span className="notification-preview-icon" aria-hidden="true"><Bell size={17} /></span>
          <span className="notification-preview-text"><strong>{preview.actor.name}</strong> {notificationCopy(preview.type)}</span>
        </Link>
      )}
    </div>,
    document.body,
  )
}
