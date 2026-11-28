import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { fetchNotifications, fetchUnreadNotifications, markNotificationsRead } from './notifications'
import { queryKey } from './queryCache'
import { useQuery } from './useQuery'

const POLL_INTERVAL = 15_000
const NO_ROWS = []

export function useNotifications({ open }) {
  const { session } = useAuth()
  const userId = session?.user?.id
  const accessToken = session?.access_token
  const enabled = !!supabase && !!userId
  const unread = useQuery(queryKey('notification-unread', userId), () => fetchUnreadNotifications(userId), { enabled })
  const inbox = useQuery(queryKey('notifications', userId), () => fetchNotifications(userId), { enabled: enabled && open })
  const { reload: reloadCount } = unread
  const { reload: reloadInbox } = inbox
  const newestId = inbox.data?.rows[0]?.id
  const scope = useMemo(() => ({ userId, newestId, open }), [userId, newestId, open])
  const [older, setOlder] = useState(null)
  const [writes, setWrites] = useState(0)
  const [writeError, setWriteError] = useState(false)
  const more = older?.scope === scope ? older : null
  const hasMore = more?.hasMore ?? inbox.data?.hasMore ?? false
  const notifications = more ? [...(inbox.data?.rows ?? NO_ROWS), ...more.rows] : inbox.data?.rows ?? NO_ROWS

  const refresh = useCallback(() => {
    reloadCount()
    reloadInbox()
  }, [reloadCount, reloadInbox])

  useEffect(() => {
    if (!enabled) return
    let subscribed = true
    let channel
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    async function listen() {
      try {
        await supabase.realtime.setAuth(accessToken)
        if (!subscribed) return
        channel = supabase.channel(`notifications:${userId}`, { config: { private: true, broadcast: { replication_ready: true } } })
          .on('broadcast', { event: 'changed' }, () => { if (subscribed) refresh() })
          .on('system', '*', ({ extension, status }) => {
            if (subscribed && extension === 'system' && status === 'ok') refresh()
          })
          .subscribe(status => { if (subscribed && status === 'SUBSCRIBED') refresh() })
      } catch {
        // Foreground refresh and polling still work without Realtime.
      }
    }

    void listen()
    const timer = setInterval(refreshWhenVisible, POLL_INTERVAL)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('focus', refreshWhenVisible)
    window.addEventListener('online', refreshWhenVisible)
    return () => {
      subscribed = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('focus', refreshWhenVisible)
      window.removeEventListener('online', refreshWhenVisible)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [enabled, userId, accessToken, refresh])

  async function loadMore() {
    const beforeId = notifications.at(-1)?.id
    if (beforeId == null || !hasMore || more?.loading) return
    setOlder({ scope, rows: more?.rows ?? NO_ROWS, hasMore: true, loading: true })
    try {
      const page = await fetchNotifications(userId, beforeId)
      setOlder(current => current?.scope === scope ? { scope, rows: [...current.rows, ...page.rows], hasMore: page.hasMore } : current)
    } catch {
      setOlder(current => current?.scope === scope ? { ...current, loading: false, error: true } : current)
    }
  }

  async function markRead(id, all = false) {
    if (id == null || !enabled) return false
    setWrites(n => n + 1)
    setWriteError(false)
    try {
      const readAt = await markNotificationsRead(userId, id, all)
      setOlder(current => current && {
        ...current,
        rows: current.rows.map(item => (all ? item.id <= id : item.id === id) && !item.readAt ? { ...item, readAt } : item),
      })
      refresh()
      return true
    } catch {
      setWriteError(true)
      return false
    } finally {
      setWrites(n => n - 1)
    }
  }

  return {
    unreadCount: unread.data ?? 0,
    notifications,
    loading: inbox.loading,
    error: inbox.error || more?.error,
    reload: more?.error ? loadMore : refresh,
    markRead,
    markAllRead: () => markRead(newestId, true),
    hasMore,
    loadMore,
    loadingMore: !!more?.loading,
    marking: writes > 0 || !inbox.data,
    writeError,
  }
}
