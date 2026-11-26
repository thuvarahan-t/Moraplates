// All Supabase reads and writes outside the home summary (api.js).
import { supabase } from '../lib/supabase'
import { photoUrl, uploadPhoto, compressImage } from '../lib/photos'

const need = () => { if (!supabase) throw new Error('This needs a Supabase project. Add keys to .env.') }
const check = ({ data, error }) => { if (error) throw error; return data }

export const toCanteen = r => ({
  id: r.id, name: r.name, location: r.location, lat: r.lat, lng: r.lng,
  opensAt: r.opens_at, closesAt: r.closes_at, knownFor: r.known_for, colour: r.colour,
  photo: photoUrl(r.photo_path), votes: r.votes_this_week ?? 0, closedUntil: r.reported_closed_until,
})
export const toFood = r => ({
  id: r.id, canteenId: r.canteen_id, name: r.name, price: r.price, photo: photoUrl(r.photo_path),
  superCount: r.super_count ?? 0, okayCount: r.okay_count ?? 0, avoidCount: r.avoid_count ?? 0,
})

/** Turns Supabase errors into something a student can act on. */
export function friendly(e) {
  if (e?.code === '42501' || /row-level security/i.test(e?.message ?? '')) return 'Only signed-in @uom.lk accounts can do that.'
  if (e?.code === '23505') return 'That already exists. Pick it from the list instead.'
  return e?.message || 'Something went wrong. Try again.'
}

// ---------------------------------------------------------------- posts

const POST_FIELDS = 'id, user_id, canteen_id, rating, caption, photo_path, created_at, author:profiles!posts_user_id_fkey(full_name, faculty, avatar_path), food:foods(name, price), likes(count), comments(count)'

/** Latest posts, optionally for one canteen or one author, with the viewer's likes. */
export async function fetchPosts(viewerId, { canteenId, authorId, postId, before, unseen = false, limit = 60 } = {}) {
  need()
  let q = supabase.from('posts').select(POST_FIELDS + (viewerId && unseen ? ', seen:post_views()' : '')).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit)
  if (viewerId && unseen) q = q.is('seen', null)
  if (postId) q = q.eq('id', postId)
  if (before) q = q.or('created_at.lt.' + before.createdIso + ',and(created_at.eq.' + before.createdIso + ',id.lt.' + before.id + ')')
  if (canteenId) q = q.eq('canteen_id', canteenId)
  if (authorId) q = q.eq('user_id', authorId)
  // Resolve likes only for the returned page (not an arbitrary recent-likes limit).
  const rows = check(await q)
  const mine = new Set(viewerId && rows.length ? check(await supabase.from('likes').select('post_id').eq('user_id', viewerId).in('post_id', rows.map(r => r.id))).map(l => l.post_id) : [])
  return rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    canteenId: r.canteen_id,
    rating: r.rating,
    caption: r.caption,
    photo: photoUrl(r.photo_path),
    photoPath: r.photo_path,
    createdIso: r.created_at,
    createdAt: Date.parse(r.created_at),
    author: { name: r.author?.full_name ?? 'Student', faculty: r.author?.faculty, avatar: photoUrl(r.author?.avatar_path) },
    food: { name: r.food?.name ?? 'Plate', price: r.food?.price ?? 0 },
    likes: r.likes[0]?.count ?? 0,
    comments: r.comments[0]?.count ?? 0,
    liked: mine.has(r.id),
  }))
}

export async function setLike(postId, userId, liked) {
  need()
  check(liked
    ? await supabase.from('likes').insert({ post_id: postId })
    : await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId))
}

// ---------------------------------------------------------------- comments

export async function fetchComments(postId) {
  need()
  const rows = check(await supabase.from('comments')
    .select('id, user_id, body, created_at, author:profiles(full_name, avatar_path)')
    .eq('post_id', postId).order('created_at'))
  return rows.map(r => ({ id: r.id, userId: r.user_id, body: r.body, createdAt: Date.parse(r.created_at), author: r.author?.full_name ?? 'Student', avatar: photoUrl(r.author?.avatar_path) }))
}
export async function addComment(postId, body) {
  need()
  check(await supabase.from('comments').insert({ post_id: postId, body }))
}
export async function deleteComment(id) {
  need()
  const rows=check(await supabase.from('comments').delete().eq('id', id).select('id'))
  if(!rows.length)throw new Error('Comment not found or not yours.')
}

// ---------------------------------------------------------------- canteens, foods, votes

export async function fetchCanteenPage(id, viewerId) {
  need()
  const [c, foods, posts, vote, photos] = await Promise.all([
    supabase.from('canteen_standings').select('*').eq('id', id).maybeSingle(),
    supabase.from('food_stats').select('*').eq('canteen_id', id),
    fetchPosts(viewerId, { canteenId: id, limit: 4 }),
    viewerId ? supabase.rpc('my_vote') : Promise.resolve({ data: null }),
    fetchCanteenPhotos(id),
  ])
  const all = check(await supabase.from('canteen_standings').select('id, votes_this_week'))
  const row = check(c)
  if (!row) return null
  const rank = 1 + all.filter(x => x.votes_this_week > row.votes_this_week).length
  return { canteen: toCanteen(row), rank, foods: check(foods).map(toFood), posts, myVote: check(vote), photos }
}

/** Sets the location of a canteen that has none yet. Returns false if someone pinned it first. */
export async function pinCanteen(id, lat, lng) {
  need()
  const rows = check(await supabase.from('canteens').update({ lat, lng }).eq('id', id).is('lat', null).select('id'))
  return rows.length > 0
}

export async function castVote(canteenId) { need(); check(await supabase.rpc('cast_vote', { canteen: canteenId })) }
export async function removeVote() { need(); check(await supabase.rpc('remove_vote')) }

export async function addFood(canteenId, name, price) {
  need()
  check(await supabase.from('foods').insert({ canteen_id: canteenId, name, price }))
}

/** Creates a canteen; uploads its photo first when there is one. Returns the new id. */
export async function addCanteen(userId, { name, location, lat, lng, opensAt, closesAt, knownFor, photo }) {
  need()
  const row = check(await supabase.from('canteens').insert({
    name, location, lat, lng, opens_at: opensAt, closes_at: closesAt, known_for: knownFor || null,
  }).select('id').single())
  if (photo) await addCanteenPhoto(userId, row.id, photo)
  return row.id
}

// ---------------------------------------------------------------- canteen photos

/** Canteen gallery photos, newest first; one canteen or all of them (home banner). */
export async function fetchCanteenPhotos(canteenId, limit = 30) {
  need()
  let q = supabase.from('canteen_photos')
    .select('id, canteen_id, user_id, photo_path, created_at, author:profiles(full_name)')
    .order('created_at', { ascending: false }).limit(limit)
  if (canteenId) q = q.eq('canteen_id', canteenId)
  return check(await q).map(r => ({
    id: r.id, canteenId: r.canteen_id, userId: r.user_id, path: r.photo_path,
    url: photoUrl(r.photo_path), by: r.author?.full_name ?? 'Student', createdAt: Date.parse(r.created_at),
  }))
}

export async function addCanteenPhoto(userId, canteenId, file) {
  need()
  const path = await uploadPhoto(userId, await compressImage(file))
  try { check(await supabase.from('canteen_photos').insert({ canteen_id: canteenId, photo_path: path })) }
  catch (e) { await supabase.storage.from('photos').remove([path]); throw e }
}

/** Only works for the person who added it (RLS + storage policy). */
export async function deleteCanteenPhoto(photo) {
  need()
  const rows = check(await supabase.from('canteen_photos').delete().eq('id', photo.id).select('id'))
  if (!rows.length) throw new Error('Photo not found or not yours.')
  const { error } = await supabase.storage.from('photos').remove([photo.path])
  if (error) console.warn('Photo row deleted but file remains:', error.message)
}

// ---------------------------------------------------------------- top + profile

export async function fetchTop(viewerId) {
  need()
  const [c, f, p, vote, photos] = await Promise.all([
    supabase.from('canteen_standings').select('*').order('votes_this_week', { ascending: false }),
    supabase.from('food_stats').select('*'),
    supabase.from('profile_stats').select('user_id, full_name, avatar_path, plates').gt('plates', 0).order('plates', { ascending: false }).limit(4),
    viewerId ? supabase.rpc('my_vote') : Promise.resolve({ data: null }),
    fetchCanteenPhotos(null, 150),
  ])
  return { canteens: check(c).map(toCanteen), foods: check(f).map(toFood), foodies: check(p).map(r => ({ ...r, avatar: photoUrl(r.avatar_path) })), myVote: check(vote), photos }
}

export async function fetchProfilePage(userId) {
  need()
  const [stats, posts, vote] = await Promise.all([
    supabase.from('profile_stats').select('*').eq('user_id', userId).maybeSingle(),
    fetchPosts(userId, { authorId: userId, limit: 60 }),
    supabase.rpc('my_vote'),
  ])
  const fav = check(vote)
  const favCanteen = fav ? check(await supabase.from('canteens').select('id, name').eq('id', fav).maybeSingle()) : null
  return { stats: check(stats), posts, favCanteen }
}

/** Someone else's profile: details, stats and plates. Votes stay private. */
export async function fetchPublicProfile(userId, viewerId) {
  need()
  const [pr, stats, posts] = await Promise.all([
    supabase.from('profiles').select('id, full_name, faculty, batch, avatar_path').eq('id', userId).maybeSingle(),
    supabase.from('profile_stats').select('*').eq('user_id', userId).maybeSingle(),
    fetchPosts(viewerId, { authorId: userId, limit: 60 }),
  ])
  const row = check(pr)
  if (!row) return null
  return {
    profile: { id: row.id, fullName: row.full_name, faculty: row.faculty, batch: row.batch, avatar: photoUrl(row.avatar_path) },
    stats: check(stats),
    posts,
  }
}

/** Uploads a new profile picture and removes the old file. */
export async function updateAvatar(userId, file, oldPath) {
  need()
  const path = await uploadPhoto(userId, await compressImage(file, 600))
  try { check(await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId).select('id').single()) }
  catch (e) { await supabase.storage.from('photos').remove([path]); throw e }
  if (oldPath) await supabase.storage.from('photos').remove([oldPath])
}

export async function updateProfile(userId, { fullName, faculty, batch }) {
  need()
  check(await supabase.from('profiles').update({ full_name: fullName, faculty: faculty || null, batch: batch || null }).eq('id', userId))
}

export async function markPostSeen(postId) {
  need()
  const { error } = await supabase.from('post_views').insert({ post_id: postId })
  if (error && error.code !== '23505') throw error
}

export async function deleteOwnPost(postId, userId) {
  need()
  const row = check(await supabase.from('posts').delete().eq('id', postId).eq('user_id', userId).select('photo_path').maybeSingle())
  if (!row) throw new Error('Post not found or not yours.')
  const { error } = await supabase.storage.from('photos').remove([row.photo_path])
  return { storageRemoved: !error }
}

export async function fetchPeople(term = '', excludeId, limit = 12) {
  need()
  let q = supabase.from('profiles').select('id, full_name, faculty, batch, avatar_path').order('created_at', { ascending: false }).limit(limit)
  if (excludeId) q = q.neq('id', excludeId)
  const clean = term.trim().replace(/[%_*(),]/g, ' ').trim()
  if (clean) q = q.ilike('full_name', '%' + clean + '%')
  return check(await q).map(r => ({ id:r.id, name:r.full_name, faculty:r.faculty, batch:r.batch, avatar:photoUrl(r.avatar_path) }))
}
export async function reportClosed(id, withdraw = false) {
  need(); check(await supabase.rpc(withdraw ? 'withdraw_canteen_closed' : 'report_canteen_closed', { canteen: id }))
}
