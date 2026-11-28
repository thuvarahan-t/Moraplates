import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createPhotoHandler } from '../../server/photo-handler.js'

const photoPath = '01234567-89ab-cdef-0123-456789abcdef/image.jpg'
const env = { VITE_SUPABASE_URL: 'https://storage.invalid/', VITE_SUPABASE_ANON_KEY: 'test-anon-key' }

async function withPhotoServer(fetchImpl, check) {
  const server = createServer(createPhotoHandler(env, { fetchImpl }))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    await check(`http://127.0.0.1:${server.address().port}/api/photo?path=`)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

test('photo handler blocks a newly hidden asset without using the cached Storage copy', async () => {
  const requests = []
  let visible = true
  await withPhotoServer(async (url, options) => {
    requests.push([url, options])
    if (url.endsWith('/can_serve_photo')) return Response.json(visible)
    return new Response(options.method === 'HEAD' ? null : new Uint8Array([0xff, 0xd8, 0xff]), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000' },
    })
  }, async endpoint => {
    const url = endpoint + encodeURIComponent(photoPath)
    const allowed = await fetch(url, { headers: { Authorization: 'Bearer untrusted-caller' } })
    assert.equal(allowed.status, 200)
    assert.equal(allowed.headers.get('Cache-Control'), 'private, no-store')
    assert.equal(allowed.headers.get('Content-Type'), 'image/jpeg')
    assert.deepEqual([...new Uint8Array(await allowed.arrayBuffer())], [0xff, 0xd8, 0xff])
    assert.equal(requests[0][0], 'https://storage.invalid/rest/v1/rpc/can_serve_photo')
    assert.deepEqual(JSON.parse(requests[0][1].body), { photo_path: photoPath })
    assert.equal(requests[1][0], `https://storage.invalid/storage/v1/object/authenticated/photos/${photoPath}`)
    assert.equal(requests[1][1].headers.Authorization, 'Bearer test-anon-key')

    const head = await fetch(url, { method: 'HEAD' })
    assert.equal(head.status, 200)
    assert.equal(head.headers.get('Content-Type'), 'image/jpeg')
    assert.equal(await head.text(), '')
    assert.equal(requests[3][1].method, 'HEAD')

    visible = false
    const hidden = await fetch(url)
    assert.equal(hidden.status, 404)
    assert.equal(await hidden.text(), '')
    assert.equal(requests.length, 5)
  })
})

test('photo handler rejects invalid paths and methods before touching Supabase', async () => {
  let requests = 0
  await withPhotoServer(async () => { requests += 1 }, async endpoint => {
    for (const invalid of ['../image.jpg', `/${photoPath}`, `${photoPath}\n`, photoPath + '/image.png']) {
      assert.equal((await fetch(endpoint + encodeURIComponent(invalid))).status, 400)
    }
    assert.equal((await fetch(endpoint + encodeURIComponent(photoPath) + '&path=another.jpg')).status, 400)
    const method = await fetch(endpoint + encodeURIComponent(photoPath), { method: 'POST' })
    assert.equal(method.status, 405)
    assert.equal(method.headers.get('Allow'), 'GET, HEAD')
    assert.equal(requests, 0)
  })
})
