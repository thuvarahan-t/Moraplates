// All Supabase reads and writes outside the home summary (api.js).
import { supabase } from '../lib/supabase'
import { photoUrl, uploadPhoto, compressImage } from '../lib/photos'
import { isMissingSeenSchema, queryWithSeenFallback } from '../lib/optionalSchema'
import { byVotes, HOME_CANTEEN_PHOTO_LIMIT } from '../lib/food'
import { BADGES, isVerifiedProfile } from '../lib/badges'

const need = () => { if (!supabase) throw new Error('This needs a Supabase project. Add keys to .env.') }
const check = ({ data, error }) => { if (error) throw error; return data }
const VERIFIED_STATS_FIELDS = ['user_id', ...new Set(BADGES.map(badge => badge.stat))].join(', ')

export const toCanteen = r => ({
  id: r.id, name: r.name, location: r.location, lat: r.lat, lng: r.lng,
  opensAt: r.opens_minute == null ? r.opens_at : r.opens_minute / 60,
  closesAt: r.closes_minute == null ? r.closes_at : r.closes_minute / 60,
  knownFor: r.known_for, colour: r.colour,
  photo: photoUrl(r.photo_path), photoPath: r.photo_path, votes: r.votes_this_week ?? 0,
  closedUntil: r.reported_closed_until, openUntil: r.reported_open_until, closedTodayUntil: r.reported_closed_today_until,
  lastReportedAt: r.last_reported_at, lastReportedStatus: r.last_reported_status,
  primaryPhoto: r.primary_photo_id ? {
    id: r.primary_photo_id, canteenId: r.id, userId: r.primary_photo_user_id,
    path: r.primary_photo_path, url: photoUrl(r.primary_photo_path), by: r.primary_photo_author ?? 'Student',
  } : null,
})
export const toFood = r => ({
  id: r.id, canteenId: r.canteen_id, name: r.name, price: r.price, photo: photoUrl(r.photo_path), photoPath: r.photo_path,
  superCount: r.super_count ?? 0, okayCount: r.okay_count ?? 0, avoidCount: r.avoid_count ?? 0,
})

export async function fetchCanteenStandings() {
  return check(await supabase.from('canteen_standings').select('*')).map(toCanteen)
}

export async function fetchFoodStats() {
  return check(await supabase.from('food_stats').select('*')).map(toFood)
}

/** Turns Supabase errors into something a student can act on. */
export function friendly(e) {
  if (e?.code === '42501' || /row-level security/i.test(e?.message ?? '')) return 'Only signed-in @uom.lk accounts can do that.'
  if (e?.code === '23505') return 'That already exists. Pick it from the list instead.'
  return e?.message || 'Something went wrong. Try again.'
}

// ---------------------------------------------------------------- posts

const POST_FIELDS = 'id, user_id, canteen_id, food_id, rating, caption, photo_path, created_at, author:profiles!posts_user_id_fkey(full_name, faculty, avatar_path), food:foods(name, price), likes(count), comments(count)'
export const POST_READS = ['feed', 'own-profile', 'public-profile', 'post', 'canteen', 'food-posts']

/** Latest posts, optionally for one canteen, food or author, with the viewer's likes. */
export async function fetchPosts(viewerId, { canteenId, foodId, authorId, postId, before, unseen = false, withFollowing = false, limit = 60 } = {}) {
  need()
  const query = includeSeen => {
    let q = supabase.from('posts').select(POST_FIELDS + (includeSeen ? ', seen:post_views()' : '')).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit)
    if (includeSeen) q = q.is('seen', null)
    if (postId) q = q.eq('id', postId)
    if (before) q = q.or('created_at.lt.' + before.createdIso + ',and(created_at.eq.' + before.createdIso + ',id.lt.' + before.id + ')')
    if (canteenId) q = q.eq('canteen_id', canteenId)
    if (foodId) q = q.eq('food_id', foodId)
    if (authorId) q = q.eq('user_id', authorId)
    return q
  }
  // Keep the actual live posts readable if the seen-history migration is pending.
  // The feed already filters locally remembered post IDs in that case.
  const rows = check(await queryWithSeenFallback(query, !!viewerId && unseen))
  const authorIds = [...new Set(rows.map(r => r.user_id))]
  const followingReadAt = withFollowing && viewerId ? Date.now() : undefined
  const [likes, badgeStats, follows] = rows.length ? await Promise.all([
    viewerId ? supabase.from('likes').select('post_id').eq('user_id', viewerId).in('post_id', rows.map(r => r.id)) : { data: [] },
    supabase.from('profile_stats').select(VERIFIED_STATS_FIELDS).in('user_id', authorIds),
    withFollowing && viewerId ? supabase.from('profile_follows').select('followed_id').eq('follower_id', viewerId).in('followed_id', authorIds) : null,
  ]) : [{ data: [] }, { data: [] }, null]
  const mine = new Set(check(likes).map(l => l.post_id))
  if (badgeStats.error) console.warn('Post author badges unavailable', badgeStats.error.message)
  const verified = new Set((badgeStats.data ?? []).filter(isVerifiedProfile).map(r => r.user_id))
  const followed = follows?.data && new Set(follows.data.map(row => row.followed_id))
  return rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    canteenId: r.canteen_id,
    foodId: r.food_id,
    rating: r.rating,
    caption: r.caption,
    photo: photoUrl(r.photo_path),
    photoPath: r.photo_path,
    createdIso: r.created_at,
    createdAt: Date.parse(r.created_at),
    author: { name: r.author?.full_name ?? 'Student', faculty: r.author?.faculty, avatar: photoUrl(r.author?.avatar_path), verified: verified.has(r.user_id) },
    food: { name: r.food?.name ?? 'Plate', price: r.food?.price ?? 0 },
    likes: r.likes[0]?.count ?? 0,
    comments: r.comments[0]?.count ?? 0,
    liked: mine.has(r.id),
    ...(followed && { viewerFollows: followed.has(r.user_id), followingReadAt }),
  }))
}

export async function setLike(postId, userId, liked) {
  need()
  check(liked
    ? await supabase.from('likes').insert({ post_id: postId })
    : await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId))
}

async function removePostPhoto(path) {
  try {
    const { error } = await supabase.storage.from('photos').remove([path])
    return !error
  } catch {
    return false
  }
}

export async function updateOwnPost(postId, userId, { canteenId, foodId, rating, caption, photo }) {
  need()
  const stagedPath = photo ? await uploadPhoto(userId, photo) : null
  const result = await supabase.rpc('edit_own_post', {
    target_post: postId,
    target_canteen: canteenId,
    target_food: foodId,
    target_rating: rating,
    target_caption: caption,
    target_photo_path: stagedPath,
  })
  if (result.error) {
    // Keep the staged image if a network failure leaves the commit uncertain.
    const rejected = result.status >= 400 && result.status < 500 &&
      /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(result.error.code ?? '')
    if (stagedPath && rejected) await removePostPhoto(stagedPath)
    if (result.error.code === 'PGRST202') throw new Error('Post editing is unavailable right now.')
    throw result.error
  }
  return { photoCleanupFailed: result.data ? !(await removePostPhoto(result.data)) : false }
}

// ---------------------------------------------------------------- comments

const COMMENT_FIELDS = 'id, user_id, body, created_at, author:profiles!comments_user_id_fkey(full_name, avatar_path)'

const toComment = r => ({
  id: r.id,
  parentId: r.parent_id ?? null,
  userId: r.user_id,
  body: r.body,
  createdAt: Date.parse(r.created_at),
  author: r.author?.full_name ?? 'Student',
  avatar: photoUrl(r.author?.avatar_path),
})

export async function fetchComments(postId) {
  need()
  const read = fields => supabase.from('comments').select(fields).eq('post_id', postId).order('created_at').order('id')
  const result = await read(COMMENT_FIELDS + ', parent_id')
  const missingParent = ['42703', 'PGRST204'].includes(result.error?.code) && /\bparent_id\b/i.test(result.error.message)
  const rows = check(missingParent ? await read(COMMENT_FIELDS) : result)
  return { list: rows.map(toComment), repliesEnabled: !missingParent }
}
export async function addComment(postId, body, parentId) {
  need()
  const payload = { post_id: postId, body, ...(parentId ? { parent_id: parentId } : {}) }
  const row = check(await supabase.from('comments').insert(payload).select(COMMENT_FIELDS).single())
  return toComment({ ...row, parent_id: parentId })
}
export async function deleteComment(id) {
  need()
  const rows=check(await supabase.from('comments').delete().eq('id', id).select('id'))
  if(!rows.length)throw new Error('Comment not found or not yours.')
}

// ---------------------------------------------------------------- canteens, foods, votes

export async function fetchFoodPageDetails(canteenId, foodId) {
  // Food IDs are UUIDs in Supabase. A malformed URL refers to no food.
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(foodId)) return null
  const [canteenResult, foodResult] = await Promise.all([
    supabase.from('canteen_standings').select('*').eq('id', canteenId).maybeSingle(),
    supabase.from('food_stats').select('*').eq('canteen_id', canteenId).eq('id', foodId).maybeSingle(),
  ])
  const canteen = check(canteenResult)
  const food = check(foodResult)
  return canteen && food ? { canteen: toCanteen(canteen), food: toFood(food) } : null
}

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

export async function updateFood(foodId, name, price) {
  need()
  const result = await supabase.rpc('update_food', { target_food: foodId, new_name: name, new_price: price })
  if (result.error?.code === 'PGRST202') throw new Error('Food editing is unavailable right now.')
  check(result)
}

/** Creates a canteen; an optional gallery upload must not mask successful creation. */
export async function addCanteen(userId, { name, location, lat, lng, opensAt, closesAt, knownFor, photo }) {
  need()
  const row = check(await supabase.from('canteens').insert({
    name, location, lat, lng, opens_at: opensAt, closes_at: closesAt, known_for: knownFor || null,
  }).select('id').single())
  let photoError=false
  if (photo) try{await addCanteenPhoto(userId,row.id,photo)}catch(e){console.warn(e);photoError=true}
  return {id:row.id,photoError}
}

// ---------------------------------------------------------------- canteen photos

const CANTEEN_PHOTO_FIELDS = 'id, canteen_id, user_id, photo_path, created_at, author:profiles(full_name)'
const toCanteenPhoto = r => ({
  id: r.id, canteenId: r.canteen_id, userId: r.user_id, path: r.photo_path,
  url: photoUrl(r.photo_path), by: r.author?.full_name ?? 'Student', createdAt: Date.parse(r.created_at),
})

/** Canteen gallery photos, newest first. */
export async function fetchCanteenPhotos(canteenId, limit = 30, offset = 0) {
  need()
  let q = supabase.from('canteen_photos').select(CANTEEN_PHOTO_FIELDS)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + limit - 1)
  if (canteenId) q = q.eq('canteen_id', canteenId)
  return check(await q).map(toCanteenPhoto)
}

export const CANTEEN_GALLERY_KEY = 'canteen-gallery'
export const fetchCanteenGallery = () => fetchCanteenPhotos(null, 150)

export async function fetchHomeCanteenPhotos() {
  need()
  // Limit the embedded gallery, so a busy canteen cannot crowd out another.
  const rows = check(await supabase.from('canteens')
    .select(`photos:canteen_photos!canteen_photos_canteen_id_fkey(${CANTEEN_PHOTO_FIELDS})`)
    .order('created_at', { referencedTable: 'photos', ascending: false })
    .order('id', { referencedTable: 'photos', ascending: false })
    .limit(HOME_CANTEEN_PHOTO_LIMIT, { referencedTable: 'photos' }))
  return rows.flatMap(row => row.photos.map(toCanteenPhoto))
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
  return !error
}

// ---------------------------------------------------------------- top + profile

async function fetchMyVote() {
  return check(await supabase.rpc('my_vote'))
}

export async function fetchTop(viewerId, cache) {
  need()
  const [c, f, p, vote, photos] = await Promise.all([
    cache.load('canteen-standings', fetchCanteenStandings),
    cache.load('food-stats', fetchFoodStats),
    supabase.from('profile_stats').select('user_id, full_name, avatar_path, plates').gt('plates', 0).order('plates', { ascending: false }).limit(4),
    viewerId ? cache.load('my-vote', fetchMyVote) : null,
    cache.load(CANTEEN_GALLERY_KEY, fetchCanteenGallery),
  ])
  return { canteens: [...c].sort(byVotes), foods: f, foodies: check(p).map(r => ({ ...r, avatar: photoUrl(r.avatar_path) })), myVote: vote, photos }
}

export async function fetchProfilePage(userId, cache) {
  need()
  const [stats, posts, vote] = await Promise.all([
    supabase.from('profile_stats').select('*').eq('user_id', userId).maybeSingle(),
    fetchPosts(userId, { authorId: userId, limit: 60 }),
    cache.load('my-vote', fetchMyVote),
  ])
  const favCanteen = vote ? check(await supabase.from('canteens').select('id, name').eq('id', vote).maybeSingle()) : null
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
    profile: { id: row.id, fullName: row.full_name, faculty: row.faculty, batch: row.batch, avatarPath: row.avatar_path, avatar: photoUrl(row.avatar_path) },
    stats: check(stats),
    posts,
  }
}

export async function fetchFollowSummary(userId) {
  need()
  const followingReadAt = Date.now()
  const result = await supabase.rpc('profile_follow_summary', { target: userId }).single()
  if (result.error?.code === 'PGRST202') return null
  const summary = check(result)
  return summary && { ...summary, followingReadAt }
}

export async function setProfileFollow(userId, viewerId, following) {
  need()
  const follows = supabase.from('profile_follows')
  check(following
    ? await follows.upsert({ followed_id: userId }, { onConflict: 'follower_id,followed_id', ignoreDuplicates: true })
    : await follows.delete().eq('follower_id', viewerId).eq('followed_id', userId))
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
  if (error && error.code !== '23505' && !isMissingSeenSchema(error)) throw error
}

export async function deleteOwnPost(postId, userId) {
  need()
  const row = check(await supabase.from('posts').delete().eq('id', postId).eq('user_id', userId).select('photo_path').maybeSingle())
  if (!row) throw new Error('Post not found or not yours.')
  return { storageRemoved: !row.photo_path || await removePostPhoto(row.photo_path) }
}

export async function fetchPeople(term = '', excludeId, limit = 12) {
  need()
  let q = supabase.from('profiles').select('id, full_name, faculty, batch, avatar_path').order('created_at', { ascending: false }).limit(limit)
  if (excludeId) q = q.neq('id', excludeId)
  const clean = term.trim().replace(/[%_*(),]/g, ' ').trim()
  if (clean) q = q.ilike('full_name', '%' + clean + '%')
  return check(await q).map(r => ({ id:r.id, name:r.full_name, faculty:r.faculty, batch:r.batch, avatar:photoUrl(r.avatar_path) }))
}
const CANTEEN_STATUS_RPC = {
  closed: 'report_canteen_closed_today',
  open: 'report_canteen_open',
}

export async function reportCanteenStatus(id, status) {
  need()
  const result = await supabase.rpc(CANTEEN_STATUS_RPC[status], { canteen: id })
  if (result.error?.code === 'PGRST202') {
    throw new Error(status === 'open' ? 'Open reports are unavailable right now.' : 'Closure reporting is unavailable right now.')
  }
  check(result)
}
