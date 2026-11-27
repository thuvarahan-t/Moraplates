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
let food,post,path,adminCanteen
try{
  for(let i=0;i<2;i++){
    const email='test-'+randomUUID()+'@uom.lk',password='Test!'+randomUUID()
    const {user}=check(await service.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Test Foodie '+i}}))
    users.push({id:user.id,client:client(anon)})
    check(await users[i].client.auth.signInWithPassword({email,password}))
  }
  const a=users[0],b=users[1]
  food=check(await a.client.from('foods').insert({canteen_id:'wala',name:'Test '+randomUUID().slice(0,8),price:200}).select('id').single()).id
  path=a.id+'/'+randomUUID()+'.png'
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT2QAAAAASUVORK5CYII=','base64')
  check(await a.client.storage.from('photos').upload(path,png,{contentType:'image/png'}))
  post=check(await a.client.from('posts').insert({canteen_id:'wala',food_id:food,rating:'super',photo_path:path,caption:'Integration test'}).select('id').single()).id
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
  const guest = client(anon)
  const status = async () => check(await guest.from('canteen_standings')
    .select('reported_closed_until, reported_open_until').eq('id', adminCanteen).single())
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
  check(await b.client.rpc('report_canteen_open', reopenCanteen))
  const reopenedAgain = await status()
  assert.equal(reopenedAgain.reported_closed_until, null, 'The student who reported a day-long closure can reopen it')
  assert.ok(reopenedAgain.reported_open_until)
  check(await b.client.rpc('withdraw_canteen_closed', reopenCanteen))
  assert.deepEqual(await status(), reopenedAgain, 'Withdrawing affects only the student’s closure')

  const openReports = await a.client.from('canteen_open_reports').select('canteen_id').eq('canteen_id', adminCanteen)
  assert.ok(openReports.error || openReports.data.length === 0, 'Open report rows remain private')
  check(await b.client.rpc('admin_delete',{kind:'canteens',p:{id:adminCanteen}}));adminCanteen=null
  check(await a.client.rpc('cast_vote',{canteen:'wala'}))
  check(await a.client.rpc('cast_vote',{canteen:'goda'}))
  assert.equal(check(await a.client.rpc('my_vote')),'goda')
  check(await a.client.rpc('remove_vote'))
  assert.equal(check(await a.client.rpc('my_vote')),null)
  const deleted=check(await a.client.from('posts').delete().eq('id',post).eq('user_id',a.id).select('photo_path').single())
  assert.equal(deleted.photo_path,path)
  check(await a.client.storage.from('photos').remove([path]))
  assert.ok((await a.client.storage.from('photos').download(path)).error,'Owner photo must be removed')
  assert.equal(check(await b.client.from('posts').select('id').eq('id',post)).length,0)
  post=null;path=null
  check(await b.client.rpc('admin_delete',{kind:'foods',p:{id:food}}));food=null
  console.log('PASS: upload, non-owner protection, seen privacy, closure and reopening, admin CRUD, vote switching, owner post and storage deletion')
}finally{
  if(path)await service.storage.from('photos').remove([path])
  if(post)await service.from('posts').delete().eq('id',post)
  if(food)await service.from('foods').delete().eq('id',food)
  if(adminCanteen)await service.from('canteens').delete().eq('id',adminCanteen)
  for(const user of users)await service.auth.admin.deleteUser(user.id)
}
