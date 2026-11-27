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
  console.log('PASS: upload, non-owner protection, seen privacy, closure, admin CRUD, vote switching, owner post and storage deletion')
}finally{
  if(path)await service.storage.from('photos').remove([path])
  if(post)await service.from('posts').delete().eq('id',post)
  if(food)await service.from('foods').delete().eq('id',food)
  if(adminCanteen)await service.from('canteens').delete().eq('id',adminCanteen)
  for(const user of users)await service.auth.admin.deleteUser(user.id)
}
