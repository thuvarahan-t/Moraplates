import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell } from 'lucide-react'
import { notificationCopy, notificationDestination } from '../data/notifications'
import { useNotifications } from '../data/useNotifications'
import { timeAgo } from '../lib/format'
import Avatar from './Avatar'
import { CloseIcon } from './icons'
import { Link } from './NavLinks'
import NotificationPreview from './NotificationPreview'
import PushNotificationControl from './PushNotificationControl'
import '../styles/comments.css'
import '../styles/notifications.css'

function NotificationRow({ item, onOpen }) {
  const { actor, createdAt, readAt, type } = item
  const created = new Date(createdAt)

  return (
    <li>
      <Link className="notification-row" to={notificationDestination(item)} viewTransition={false} onClick={event => onOpen(event, item)}>
        <span className="notification-avatar" aria-hidden="true"><Avatar name={actor.name} url={actor.avatar} /></span>
        <span className="notification-copy">
          <span><strong>{actor.name}</strong> {notificationCopy(type)}</span>
          <time dateTime={created.toISOString()}>{timeAgo(created.getTime())}</time>
        </span>
        {!readAt && <span className="notification-dot"><span className="sr">Unread</span></span>}
      </Link>
    </li>
  )
}

function NotificationsDialog({ data, onClose }) {
  const dialog = useRef(null)
  const heading = useRef(null)
  const backdropPress = useRef(false)
  const titleId = useId()
  const { unreadCount, notifications, loading, error, reload, markRead, markAllRead, hasMore, loadMore, loadingMore, marking, writeError } = data
  const close = () => dialog.current?.close()

  useEffect(() => {
    if (dialog.current.open) return
    dialog.current.showModal()
    heading.current.focus({ preventScroll: true })
  }, [])

  function openNotification(event, item) {
    if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (!item.readAt) void markRead(item.id)
    close()
  }

  return createPortal(
    <dialog className="cm-dialog notifications-dialog" ref={dialog} onClose={onClose} aria-labelledby={titleId}
      onPointerDown={event => { backdropPress.current = event.target === event.currentTarget }}
      onClick={event => { if (backdropPress.current && event.target === event.currentTarget) close() }}>
      <header className="cm-header">
        <h2 id={titleId} ref={heading} tabIndex={-1}>Notifications</h2>
        <div className="notification-header-actions">
          {unreadCount > 0 && <button className="cm-text-button notification-mark-all" type="button" disabled={marking}
            onClick={markAllRead}>Mark all as read</button>}
          <button className="cm-close" type="button" aria-label="Close notifications" onClick={close}><CloseIcon size={20} /></button>
        </div>
      </header>
      <PushNotificationControl />
      <div className="cm-thread">
        {writeError && <p className="cm-write-error" role="alert">Couldn't update read status. Try again.</p>}
        {notifications.length > 0 && (
          <ul className="notification-list" role="list">
            {notifications.map(item => <NotificationRow key={item.id} item={item} onOpen={openNotification} />)}
          </ul>
        )}
        {loading && <p className="cm-status" role="status">Loading notifications…</p>}
        {error && (
          <div className="cm-status">
            <p role="alert">Couldn't load notifications.</p>
            <button className="btn sm ghost" type="button" onClick={reload}>Retry</button>
          </div>
        )}
        {!loading && !error && !notifications.length && <p className="cm-status">No notifications yet.</p>}
        {hasMore && !error && (
          <div className="notification-more">
            <button className="btn sm ghost" type="button" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </dialog>,
    document.body,
  )
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const data = useNotifications({ open })
  const unread = data.unreadCount
  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'

  return (
    <>
      <button className="social-icon notification-bell" type="button" aria-label={label} title="Notifications"
        aria-haspopup="dialog" onClick={() => { data.reload(); setOpen(true) }}>
        <Bell size={21} aria-hidden="true" />
        {unread > 0 && <span className="notification-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
      </button>
      <NotificationPreview latest={data.latestUnread} open={open} markRead={data.markRead} />
      {open && <NotificationsDialog data={data} onClose={() => setOpen(false)} />}
    </>
  )
}
