import { photoUrl } from '../lib/photos'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 25
const FIELDS = 'id, kind, post_id, comment_id, created_at, read_at, actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_path)'

function notification(row) {
  return {
    id: row.id,
    type: row.kind,
    postId: row.post_id,
    commentId: row.comment_id,
    readAt: row.read_at,
    createdAt: row.created_at,
    actor: { id: row.actor.id, name: row.actor.full_name, avatar: photoUrl(row.actor.avatar_path) },
  }
}

export function notificationCopy(type) {
  switch (type) {
    case 'like': return 'liked your post.'
    case 'reply': return 'replied to your comment.'
    case 'follow': return 'followed you.'
  }
}

export function notificationDestination({ type, postId, commentId, actor }) {
  if (type === 'reply') return `/posts/${postId}?comment=${encodeURIComponent(commentId)}`
  if (type === 'like') return `/posts/${postId}`
  return `/u/${actor.id}`
}

export async function fetchUnreadNotifications(userId) {
  const { data, count, error } = await supabase.from('notifications')
    .select(FIELDS, { count: 'exact' }).eq('recipient_id', userId).is('read_at', null)
    .order('id', { ascending: false }).limit(1)
  if (error) throw error
  return { count: count ?? 0, latest: data.length ? notification(data[0]) : null }
}

export async function fetchNotifications(userId, beforeId) {
  let query = supabase.from('notifications').select(FIELDS).eq('recipient_id', userId)
    .order('id', { ascending: false }).limit(PAGE_SIZE + 1)
  if (beforeId != null) query = query.lt('id', beforeId)
  const { data, error } = await query
  if (error) throw error
  return {
    hasMore: data.length > PAGE_SIZE,
    rows: data.slice(0, PAGE_SIZE).map(notification),
  }
}

export async function markNotificationsRead(userId, id, all) {
  const readAt = new Date().toISOString()
  const query = supabase.from('notifications').update({ read_at: readAt })
    .eq('recipient_id', userId).is('read_at', null)
  const { error } = await (all ? query.lte('id', id) : query.eq('id', id))
  if (error) throw error
  return readAt
}
