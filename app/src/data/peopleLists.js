import { supabase } from '../lib/supabase'
import { photoUrl } from '../lib/photos'

async function fetchPeopleList(rpc, args) {
  const { data, error } = await supabase.rpc(rpc, args)
  if (error) throw error
  return data.map(row => ({
    id: row.id,
    name: row.full_name,
    avatar: photoUrl(row.avatar_path),
    faculty: row.faculty,
    batch: row.batch,
  }))
}

export const fetchPostLikers = (postId, afterId, limit) => fetchPeopleList('post_liker_list', {
  target: postId, after_id: afterId, page_size: limit,
})

export const fetchProfileFollowList = (profileId, direction, afterId, limit) => fetchPeopleList('profile_follow_list', {
  target: profileId, direction, after_id: afterId, page_size: limit,
})
