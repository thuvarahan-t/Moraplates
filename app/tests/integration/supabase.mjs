import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {randomUUID} from 'node:crypto'
const url=process.env.API_URL||process.env.SUPABASE_URL
const anon=process.env.ANON_KEY||process.env.PUBLISHABLE_KEY
const serviceKey=process.env.SERVICE_ROLE_KEY||process.env.SECRET_KEY
assert.ok(url&&anon&&serviceKey,'Local Supabase environment required')
assert.ok(['127.0.0.1','localhost'].includes(new URL(url).hostname),'Refusing non-local Supabase')
const client=key=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const service=client(serviceKey)
const check=({data,error})=>{if(error)throw error;return data}
const nextColomboMidnight = time => {
  const day = 24 * 60 * 60_000
  const offset = 330 * 60_000
  return (Math.floor((time + offset) / day) + 1) * day - offset
}
const users=[]
let food,post,path,replacementPath,adminCanteen
let moderatedCanteen
const moderationPaths = []
try{
  for(let i=0;i<3;i++){
    const email='test-'+randomUUID()+'@uom.lk',password='Test!'+randomUUID()
    const {user}=check(await service.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Test Foodie '+i}}))
    users.push({id:user.id,client:client(anon)})
    check(await users[i].client.auth.signInWithPassword({email,password}))
  }
  const [a, b, moderator] = users
  food=check(await a.client.from('foods').insert({canteen_id:'wala',name:'Test '+randomUUID().slice(0,8),price:200}).select('id').single()).id
  path=a.id+'/'+randomUUID()+'.png'
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT2QAAAAASUVORK5CYII=','base64')
  check(await a.client.storage.from('photos').upload(path,png,{contentType:'image/png'}))
  post=check(await a.client.from('posts').insert({canteen_id:'wala',food_id:food,rating:'super',photo_path:path,caption:'Integration test'}).select('id').single()).id
  const guest = client(anon)
  const foodChanges = { target_food: food, new_name: '  Renamed ' + randomUUID().slice(0, 8) + '  ', new_price: 275 }
  assert.ok((await guest.rpc('update_food', foodChanges)).error, 'Guests cannot edit the menu')
  assert.equal((await b.client.rpc('update_food', { ...foodChanges, new_price: 0 })).error?.code, '22023')
  check(await b.client.rpc('update_food', foodChanges))
  assert.deepEqual(check(await guest.from('foods').select('name, price, canteen_id, created_by').eq('id', food).single()), {
    name: foodChanges.new_name.trim(), price: 275, canteen_id: 'wala', created_by: a.id,
  })

  check(await b.client.from('likes').insert({ post_id: post }))
  const postDetails = async () => check(await guest.from('posts')
    .select('created_at, user_id, caption, rating, photo_path, food_id, likes(count)').eq('id', post).single())
  const original = await postDetails()
  const postChanges = { target_post: post, target_canteen: 'wala', target_food: food, target_rating: 'okay', target_caption: '  Edited plate  ' }
  assert.ok((await guest.rpc('edit_own_post', postChanges)).error, 'Guests cannot edit a post')
  assert.equal((await b.client.rpc('edit_own_post', postChanges)).error?.code, '42501', 'Only the author can edit a post')
  assert.equal((await a.client.rpc('edit_own_post', { ...postChanges, target_canteen: 'goda' })).error?.code, '23503', 'Food must match the selected canteen')
  assert.equal((await a.client.rpc('edit_own_post', { ...postChanges, target_photo_path: b.id + '/photo.png' })).error?.code, '42501')
  assert.deepEqual(await postDetails(), original)
  assert.equal(check(await a.client.rpc('edit_own_post', postChanges)), null)
  assert.deepEqual(await postDetails(), { ...original, rating: 'okay', caption: 'Edited plate' })

  replacementPath = a.id + '/' + randomUUID() + '.png'
  check(await a.client.storage.from('photos').upload(replacementPath, png, { contentType: 'image/png' }))
  assert.equal(check(await a.client.rpc('edit_own_post', { ...postChanges, target_photo_path: replacementPath })), path)
  assert.equal((await postDetails()).photo_path, replacementPath)
  assert.equal(check(await a.client.rpc('edit_own_post', { ...postChanges, target_photo_path: path })), replacementPath)
  check(await a.client.storage.from('photos').remove([replacementPath]))
  replacementPath = null

  const unauthorized=await b.client.from('posts').delete().eq('id',post).select('id')
  assert.ok(unauthorized.error||unauthorized.data.length===0,'Other student must not delete post')
  await b.client.storage.from('photos').remove([path])
  check(await a.client.storage.from('photos').download(path))
  check(await a.client.from('post_views').insert({post_id:post}))
  assert.equal(check(await a.client.from('posts').select('id, seen:post_views()').eq('id',post).is('seen',null)).length,0)
  assert.equal(check(await b.client.from('posts').select('id, seen:post_views()').eq('id',post).is('seen',null)).length,1)
  assert.equal(check(await b.client.from('post_views').select('post_id').eq('post_id',post)).length,0)
  const canteen = { canteen: 'wala' }
  const closedUntil = async () => check(await b.client.from('canteen_standings')
    .select('reported_closed_until').eq('id', canteen.canteen).single()).reported_closed_until
  assert.ok((await client(anon).rpc('report_canteen_closed_today', canteen)).error, 'Guests cannot report closures')

  const beforeTemporary = Date.now()
  check(await a.client.rpc('report_canteen_closed', canteen))
  const temporaryExpiry = Date.parse(await closedUntil())
  assert.ok(temporaryExpiry >= beforeTemporary + 59 * 60_000 && temporaryExpiry <= Date.now() + 61 * 60_000)

  const beforeToday = Date.now()
  check(await a.client.rpc('report_canteen_closed_today', canteen))
  const todayExpiry = await closedUntil()
  assert.ok([nextColomboMidnight(beforeToday), nextColomboMidnight(Date.now())].includes(Date.parse(todayExpiry)))

  check(await a.client.rpc('report_canteen_closed', canteen))
  check(await b.client.rpc('withdraw_canteen_closed', canteen))
  assert.equal(await closedUntil(), todayExpiry, 'An active day report survives a shorter report and another student’s withdrawal')

  check(await b.client.rpc('report_canteen_closed', canteen))
  const combinedExpiry = Date.parse(await closedUntil())
  check(await a.client.rpc('withdraw_canteen_closed', canteen))
  const remainingExpiry = Date.parse(await closedUntil())
  assert.ok(remainingExpiry > Date.now(), 'The other student’s temporary report remains')
  assert.equal(combinedExpiry, Math.max(Date.parse(todayExpiry), remainingExpiry))
  check(await b.client.rpc('withdraw_canteen_closed', canteen))
  assert.equal(await closedUntil(), null)
  assert.equal(check(await a.client.rpc('is_admin')),false)
  assert.ok((await a.client.rpc('admin_list',{kind:'canteens',page_offset:0})).error)
  check(await service.from('admin_users').insert({user_id:b.id}))
  assert.equal(check(await b.client.rpc('is_admin')),true)
  const name='Test admin '+randomUUID().slice(0,8)
  check(await b.client.rpc('admin_save',{kind:'canteens',p:{name,location:'Test campus',opens_at:7,closes_at:18}}))
  adminCanteen=check(await b.client.from('canteens').select('id').eq('name',name).single()).id
  check(await b.client.rpc('admin_save',{kind:'canteens',p:{id:adminCanteen,name,location:'Updated',opens_at:8,closes_at:17}}))
  assert.equal(check(await a.client.from('canteens').select('location').eq('id',adminCanteen).single()).location,'Updated')

  const reopenCanteen = { canteen: adminCanteen }
  const pin = (client, id, pinned = true) => client.rpc('set_canteen_pin', { target_canteen: id, pinned })
  assert.ok((await pin(guest, 'wala')).error, 'Guests cannot write account pins')
  const pinned = ['wala', 'goda', 'civil']
  for (const [index, id] of pinned.entries()) {
    assert.deepEqual(check(await pin(a.client, id)), pinned.slice(0, index + 1))
  }
  assert.deepEqual(check(await pin(a.client, 'wala')), pinned, 'Pinning again is idempotent')
  assert.ok((await pin(a.client, 'village')).error, 'A fourth pin exceeds the limit')
  assert.deepEqual(check(await b.client.from('canteen_pins').select('canteen_id')), [], 'Other accounts cannot see private pins')
  check(await pin(a.client, 'goda', false))
  assert.deepEqual(check(await pin(a.client, 'village')), ['wala', 'civil', 'village'])
  const galleryPhoto = check(await a.client.from('canteen_photos')
    .insert({ canteen_id: adminCanteen, photo_path: path }).select('id').single()).id
  const timingAndCover = { id: adminCanteen, name, location: 'Updated', opens_minute: 390, closes_minute: 405, primary_photo_id: galleryPhoto }
  assert.ok((await a.client.rpc('admin_save', { kind: 'canteens', p: timingAndCover })).error)
  check(await b.client.rpc('admin_save', { kind: 'canteens', p: timingAndCover }))
  const details = async () => check(await guest.from('canteen_standings')
    .select('opens_minute, closes_minute, primary_photo_id, primary_photo_path').eq('id', adminCanteen).single())
  assert.deepEqual(await details(), { opens_minute: 390, closes_minute: 405, primary_photo_id: galleryPhoto, primary_photo_path: path })
  check(await a.client.from('canteen_photos').delete().eq('id', galleryPhoto))
  assert.equal((await details()).primary_photo_id, null)

  const status = async () => check(await guest.from('canteen_standings')
    .select('reported_closed_until, reported_open_until').eq('id', adminCanteen).single())
  const report = async () => check(await guest.from('canteen_standings')
    .select('reported_closed_today_until, last_reported_at, last_reported_status').eq('id', adminCanteen).single())
  assert.ok((await guest.rpc('report_canteen_open', reopenCanteen)).error, 'Guests cannot report reopening')
  check(await a.client.rpc('report_canteen_open', reopenCanteen))
  assert.deepEqual(await status(), { reported_closed_until: null, reported_open_until: null })

  check(await a.client.rpc('report_canteen_closed', reopenCanteen))
  assert.ok((await status()).reported_closed_until)
  const beforeReopen = Date.now()
  check(await b.client.rpc('report_canteen_open', reopenCanteen))
  const reopened = await status()
  const openExpiry = Date.parse(reopened.reported_open_until)
  assert.equal(reopened.reported_closed_until, null, 'Another student can clear an active closure')
  assert.ok(openExpiry >= beforeReopen + 59 * 60_000 && openExpiry <= Date.now() + 61 * 60_000)
  check(await a.client.rpc('report_canteen_open', reopenCanteen))
  assert.deepEqual(await status(), reopened, 'Repeating a reopening without a newer closure keeps the original expiry')

  check(await a.client.rpc('report_canteen_closed', reopenCanteen))
  const reclosed = await status()
  assert.ok(reclosed.reported_closed_until, 'The original reporter can close again after a reopening')
  assert.equal(reclosed.reported_open_until, null, 'A newer closure takes precedence over the reopening')
  check(await a.client.rpc('withdraw_canteen_closed', reopenCanteen))
  assert.deepEqual(await status(), reopened, 'Withdrawing a newer closure keeps the original open report')

  check(await a.client.rpc('report_canteen_closed', reopenCanteen))
  check(await b.client.rpc('report_canteen_closed_today', reopenCanteen))
  check(await a.client.rpc('report_canteen_open', reopenCanteen))
  assert.equal((await status()).reported_closed_until, null, 'The original reporter can clear overlapping closures')
  check(await b.client.rpc('report_canteen_closed_today', reopenCanteen))
  assert.ok((await status()).reported_closed_until, 'A suppressed report can be submitted again for the same day')
  const dayReport = await report()
  assert.equal(dayReport.last_reported_status, 'closed')
  assert.equal(Date.parse(dayReport.reported_closed_today_until), nextColomboMidnight(Date.parse(dayReport.last_reported_at)))
  check(await b.client.rpc('report_canteen_open', reopenCanteen))
  const reopenedAgain = await status()
  assert.equal(reopenedAgain.reported_closed_until, null, 'The student who reported a day-long closure can reopen it')
  assert.ok(reopenedAgain.reported_open_until)
  const openedReport = await report()
  assert.equal(openedReport.last_reported_status, 'open')
  assert.equal(Date.parse(reopenedAgain.reported_open_until) - Date.parse(openedReport.last_reported_at), 60 * 60_000)
  check(await b.client.rpc('withdraw_canteen_closed', reopenCanteen))
  assert.deepEqual(await status(), reopenedAgain, 'Withdrawing affects only the student’s closure')

  const openReports = await a.client.from('canteen_open_reports').select('canteen_id').eq('canteen_id', adminCanteen)
  assert.ok(openReports.error || openReports.data.length === 0, 'Open report rows remain private')
  check(await b.client.rpc('admin_delete',{kind:'canteens',p:{id:adminCanteen}}));adminCanteen=null
  const voteTotals = async () => Object.fromEntries(check(await guest.from('canteen_standings')
    .select('id, votes_this_week').in('id', ['wala', 'goda'])).map(row => [row.id, row.votes_this_week]))
  const beforeVotes = await voteTotals()
  check(await a.client.rpc('cast_vote',{canteen:'wala'}))
  check(await b.client.rpc('cast_vote',{canteen:'goda'}))
  assert.deepEqual(await voteTotals(), { wala: beforeVotes.wala + 1, goda: beforeVotes.goda + 1 })
  check(await a.client.rpc('cast_vote',{canteen:'goda'}))
  assert.equal(check(await a.client.rpc('my_vote')),'goda')
  assert.deepEqual(await voteTotals(), { wala: beforeVotes.wala, goda: beforeVotes.goda + 2 })
  check(await a.client.rpc('remove_vote'))
  assert.equal(check(await a.client.rpc('my_vote')),null)
  check(await b.client.rpc('remove_vote'))
  assert.deepEqual(await voteTotals(), beforeVotes)
  const deleted=check(await a.client.from('posts').delete().eq('id',post).eq('user_id',a.id).select('photo_path').single())
  assert.equal(deleted.photo_path,path)
  check(await a.client.storage.from('photos').remove([path]))
  assert.ok((await a.client.storage.from('photos').download(path)).error,'Owner photo must be removed')
  assert.equal(check(await b.client.from('posts').select('id').eq('id',post)).length,0)
  post=null;path=null
  check(await b.client.rpc('admin_delete',{kind:'foods',p:{id:food}}));food=null

  const moderate = (client, kind, id, photoPath) => client.rpc('moderate_delete', {
    kind, p: { id, ...(photoPath ? { photo_path: photoPath } : {}) },
  })
  const uploadModerationPhoto = async () => {
    const file = a.id + '/' + randomUUID() + '.png'
    moderationPaths.push(file)
    check(await a.client.storage.from('photos').upload(file, png, { contentType: 'image/png' }))
    return file
  }
  const sharedPhoto = await uploadModerationPhoto()
  const coverPhoto = await uploadModerationPhoto()
  const foodPhoto = await uploadModerationPhoto()
  const moderationCanteen = {
    name: 'Moderation ' + randomUUID().slice(0, 8), location: 'Test campus',
    lat: 6.7966, lng: 79.9018, opens_at: 7, closes_at: 18,
  }
  moderatedCanteen = check(await a.client.from('canteens').insert({
    ...moderationCanteen, photo_path: coverPhoto,
  }).select('id').single()).id
  const moderatedFood = check(await a.client.from('foods').insert({
    canteen_id: moderatedCanteen, name: 'Moderation test', price: 250, photo_path: foodPhoto,
  }).select('id').single()).id
  const postPayload = {
    canteen_id: moderatedCanteen, food_id: moderatedFood, rating: 'super', caption: 'Keep this plate',
  }
  assert.equal((await a.client.from('posts').insert(postPayload)).error?.code, '42501', 'New posts still need a photo')
  const moderatedPost = check(await a.client.from('posts').insert({
    ...postPayload, photo_path: sharedPhoto,
  }).select('id').single()).id
  const moderatedComment = check(await a.client.from('comments').insert({
    post_id: moderatedPost, body: 'Integration comment',
  }).select('id').single()).id
  const moderatedGallery = check(await a.client.from('canteen_photos').insert({
    canteen_id: moderatedCanteen, photo_path: sharedPhoto,
  }).select('id').single()).id
  check(await b.client.rpc('admin_save', {
    kind: 'canteens', p: { ...moderationCanteen, id: moderatedCanteen, primary_photo_id: moderatedGallery },
  }))

  assert.ok((await moderate(guest, 'posts', moderatedPost)).error)
  assert.equal(check(await moderator.client.rpc('is_content_moderator')), false)
  assert.equal((await moderate(moderator.client, 'posts', moderatedPost)).error?.code, '42501')
  assert.ok((await moderator.client.from('content_moderators').insert({ user_id: moderator.id })).error)
  check(await service.from('content_moderators').insert({ user_id: moderator.id }))
  assert.equal(check(await moderator.client.rpc('is_content_moderator')), true)
  assert.equal(check(await moderator.client.rpc('is_admin')), false)
  assert.equal(check(await b.client.rpc('is_content_moderator')), true)
  assert.equal((await moderate(moderator.client, 'votes', moderatedCanteen)).error?.code, '22023')
  assert.equal((await moderator.client.rpc('admin_delete', {
    kind: 'posts', p: { id: moderatedPost },
  })).error?.code, '42501')

  const removeAsModerator = path => moderator.client.storage.from('photos').remove([path])
  const hasPhoto = async path => !(await a.client.storage.from('photos').download(path)).error
  await removeAsModerator(sharedPhoto)
  assert.equal(await hasPhoto(sharedPhoto), true, 'The role cannot remove a photo before it is queued')
  assert.equal((await moderate(moderator.client, 'post_photos', moderatedPost, coverPhoto)).error?.code, 'P0002')
  assert.deepEqual(check(await moderate(moderator.client, 'post_photos', moderatedPost, sharedPhoto)), [])
  assert.deepEqual(check(await guest.from('posts').select('caption, photo_path').eq('id', moderatedPost).single()), {
    caption: 'Keep this plate', photo_path: null,
  })
  await removeAsModerator(sharedPhoto)
  assert.equal(await hasPhoto(sharedPhoto), true, 'The gallery still uses the file')
  assert.deepEqual(check(await moderate(moderator.client, 'canteen_photos', moderatedGallery, sharedPhoto)), [sharedPhoto])
  const canteenFields = fields => guest.from('canteen_standings').select(fields).eq('id', moderatedCanteen).single()
  assert.equal(check(await canteenFields('primary_photo_id')).primary_photo_id, null)

  check(await a.client.from('profiles').update({ avatar_path: sharedPhoto }).eq('id', a.id))
  await removeAsModerator(sharedPhoto)
  assert.equal(await hasPhoto(sharedPhoto), true, 'Storage checks references again at deletion time')
  assert.deepEqual(check(await moderate(moderator.client, 'profile_avatars', a.id, sharedPhoto)), [sharedPhoto])
  check(await removeAsModerator(sharedPhoto))
  assert.equal(await hasPhoto(sharedPhoto), false, 'The role can remove a queued file from another account')

  assert.deepEqual(check(await moderate(moderator.client, 'canteen_covers', moderatedCanteen, coverPhoto)), [coverPhoto])
  assert.equal(check(await canteenFields('photo_path')).photo_path, null)
  check(await removeAsModerator(coverPhoto))
  assert.equal(await hasPhoto(coverPhoto), false)
  assert.deepEqual(check(await moderate(moderator.client, 'comments', moderatedComment)), [])
  assert.equal(check(await guest.from('comments').select('id').eq('id', moderatedComment).maybeSingle()), null)
  assert.deepEqual(check(await moderate(moderator.client, 'posts', moderatedPost)), [])
  assert.equal(check(await guest.from('posts').select('id').eq('id', moderatedPost).maybeSingle()), null)

  const cascadePost = check(await a.client.from('posts').insert({
    ...postPayload, photo_path: foodPhoto,
  }).select('id').single()).id
  assert.deepEqual(check(await moderate(moderator.client, 'food_photos', moderatedFood, foodPhoto)), [])
  assert.deepEqual(check(await moderate(moderator.client, 'foods', moderatedFood)), [foodPhoto])
  assert.equal(check(await guest.from('posts').select('id').eq('id', cascadePost).maybeSingle()), null)
  check(await removeAsModerator(foodPhoto))
  assert.equal(await hasPhoto(foodPhoto), false)

  check(await a.client.rpc('report_canteen_closed_today', { canteen: moderatedCanteen }))
  check(await b.client.rpc('report_canteen_open', { canteen: moderatedCanteen }))
  assert.equal(check(await canteenFields('last_reported_status')).last_reported_status, 'open')
  check(await moderate(moderator.client, 'canteen_status_reports', moderatedCanteen))
  assert.deepEqual(check(await canteenFields('last_reported_status, reported_closed_until, reported_open_until')), {
    last_reported_status: null, reported_closed_until: null, reported_open_until: null,
  })
  check(await moderate(moderator.client, 'canteens', moderatedCanteen))
  assert.equal(check(await guest.from('canteens').select('id').eq('id', moderatedCanteen).maybeSingle()), null)
  moderatedCanteen = null

  console.log('PASS: photo upload and replacement, owner post edits, shared food edits, seen privacy, closure and reopening, personal pins, admin CRUD, weekly vote totals and switching, owner deletion, scoped moderation and cross-owner storage cleanup')
}finally{
  if(path)await service.storage.from('photos').remove([path])
  if(replacementPath)await service.storage.from('photos').remove([replacementPath])
  if(post)await service.from('posts').delete().eq('id',post)
  if(food)await service.from('foods').delete().eq('id',food)
  if(adminCanteen)await service.from('canteens').delete().eq('id',adminCanteen)
  if(moderatedCanteen)await service.from('canteens').delete().eq('id',moderatedCanteen)
  if(moderationPaths.length)await service.storage.from('photos').remove(moderationPaths)
  for(const user of users)await service.auth.admin.deleteUser(user.id)
}
