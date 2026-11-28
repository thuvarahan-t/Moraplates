import { photoUrl } from '../lib/photos'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 25
const FIELDS = 'id, kind, post_id, created_at, read_at, actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_path)'

export async function fetchUnreadNotifications(userId) {
  const { count, error } = await supabase.from('notifications')
    .select('id', { count: 'exact', head: true }).eq('recipient_id', userId).is('read_at', null)
  if (error) throw error
  return count ?? 0
}

export async function fetchNotifications(userId, beforeId) {
  let query = supabase.from('notifications').select(FIELDS).eq('recipient_id', userId)
    .order('id', { ascending: false }).limit(PAGE_SIZE + 1)
  if (beforeId != null) query = query.lt('id', beforeId)
  const { data, error } = await query
  if (error) throw error
  return {
    hasMore: data.length > PAGE_SIZE,
    rows: data.slice(0, PAGE_SIZE).map(row => ({
      id: row.id,
      type: row.kind,
      postId: row.post_id,
      readAt: row.read_at,
      createdAt: row.created_at,
      actor: { id: row.actor.id, name: row.actor.full_name, avatar: photoUrl(row.actor.avatar_path) },
    })),
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
