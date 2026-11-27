import assert from 'node:assert/strict'
import test from 'node:test'
import { createQueryCache, queryKey } from '../../src/data/queryCache.js'

test('concurrent consumers share the same request and reuse a fresh null result', async () => {
  const cache = createQueryCache()
  let calls = 0
  const loader = () => { calls++; return null }

  const first = cache.load('vote', loader)
  assert.equal(cache.load('vote', loader), first)
  assert.equal(await first, null)
  assert.equal(cache.fresh('vote'), null)
  assert.equal(await cache.load('vote', loader), null)
  assert.equal(calls, 1)
})

test('an expired read keeps its last value while retrying after an error', async () => {
  const cache = createQueryCache(0)
  await cache.load('home', () => ['canteen'])
  assert.equal(cache.fresh('home'), undefined)

  const failed = cache.load('home', () => { throw new Error('offline') })
  assert.deepEqual(cache.read('home'), ['canteen'])
  await assert.rejects(failed, /offline/)
  assert.deepEqual(cache.read('home'), ['canteen'])
  assert.deepEqual(await cache.load('home', () => ['updated']), ['updated'])
})

test('invalidation prevents an old request from replacing a newer result', async () => {
  const cache = createQueryCache()
  const key = queryKey('feed', 'it', false)
  let finishOld
  const old = cache.load(key, () => new Promise(resolve => { finishOld = resolve }))
  await Promise.resolve()
  await cache.load('home', () => ['canteens'])

  cache.invalidate('feed')
  await cache.load(key, () => ['current'])
  finishOld(['old'])
  await old
  assert.deepEqual(cache.read(key), ['current'])
  assert.deepEqual(cache.read('home'), ['canteens'])
  assert.equal(createQueryCache().read(key), undefined)
})

test('the cache evicts the least recently used entry when full', async () => {
  const cache = createQueryCache(30_000, 2)
  await cache.load('home', () => ['canteens'])
  await cache.load('profile', () => ['plates'])
  await cache.load('home', () => { throw new Error('already cached') })
  await cache.load('top', () => ['rankings'])

  assert.equal(cache.read('profile'), undefined)
  assert.deepEqual(cache.read('home'), ['canteens'])
})
