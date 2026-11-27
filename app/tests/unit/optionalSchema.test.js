import test from 'node:test'
import assert from 'node:assert/strict'
import {isMissingSeenSchema,queryWithSeenFallback} from '../../src/lib/optionalSchema.js'
test('pre-migration feed retries without post_views and keeps real rows',async()=>{
  const calls=[]
  const rows=[{id:'existing-live-post'}]
  const result=await queryWithSeenFallback(async seen=>{
    calls.push(seen)
    return seen?{data:null,error:{code:'PGRST200',message:"Could not find a relationship between 'posts' and 'post_views' in the schema cache"}}:{data:rows,error:null}
  },true)
  assert.deepEqual(calls,[true,false])
  assert.equal(result.data,rows)
})
test('missing seen table is recognized, other errors are not swallowed',async()=>{
  assert.equal(isMissingSeenSchema({code:'PGRST205',message:"Could not find the table 'public.post_views' in the schema cache"}),true)
  assert.equal(isMissingSeenSchema({code:'42P01',message:'relation public.post_views does not exist'}),true)
  for(const error of [{code:'42501',message:'permission denied for post_views'},{code:'PGRST200',message:'missing foods relation'},{message:'network error'}]){
    assert.equal(isMissingSeenSchema(error),false)
    let calls=0
    assert.equal((await queryWithSeenFallback(async()=>{calls++;return {error}},true)).error,error)
    assert.equal(calls,1)
  }
})
test('guest and ready database queries make no unnecessary retries',async()=>{
  for(const seen of [true,false]){
    const calls=[]
    const result=await queryWithSeenFallback(async value=>{calls.push(value);return {data:[]}},seen)
    assert.deepEqual(calls,[seen]);assert.deepEqual(result.data,[])
  }
})
