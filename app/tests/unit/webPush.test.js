import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { buildPushPayload, deliveryOutcome, isPushEndpoint, verifyDispatch } from '../../supabase/functions/notification-push/delivery.mjs'

const post = '94bed73c-11f8-4d61-87b8-9d9a1551f422'
const comment = 'af214409-cac0-4d41-972f-6d30a8276dc4'
const workerSource = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8')

test('Web Push dispatch accepts browser push providers and rejects unexpected origins', () => {
  const valid = [
    'https://fcm.googleapis.com/fcm/send/token',
    'https://updates.push.services.mozilla.com/wpush/v2/token',
    'https://web.push.apple.com/token',
    'https://example.notify.windows.com/?token=123',
  ]
  const invalid = [
    'http://web.push.apple.com/token',
    'https://web.push.apple.com:443/token',
    'https://web.push.apple.com.evil.example/token',
    'https://web.push.apple.com@evil.example/token',
    'https://web.push.apple.com/token#fragment',
    'https://web.push.apple.com/',
    'https://fcm.googleapis.com/somewhere-else',
    'https://127.0.0.1/internal',
  ]
  assert.ok(valid.every(isPushEndpoint))
  assert.ok(invalid.every(endpoint => !isPushEndpoint(endpoint)))
  assert.deepEqual([200, 404, 410, 429, 503].map(deliveryOutcome), ['done', 'expired', 'expired', 'retry', 'retry'])
})

test('a reply push contains an event link without names or comment text', () => {
  assert.deepEqual(buildPushPayload({
    kind: 'reply',
    notification_id: '123',
    post_id: post,
    comment_id: comment,
    message: 'Actual reply text',
  }), { kind: 'reply', id: '123', path: `/posts/${post}?comment=${comment}` })
  assert.equal(buildPushPayload({ kind: 'unknown' }), null)
})

test('an Edge dispatcher request must have a fresh signature from the DB', async () => {
  const secret = 'local-test-secret'
  const timestamp = '1800000000'
  const now = Number(timestamp) * 1000
  const key = crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const signature = createHmac('sha256', secret).update(`moraplates-notification-push-v1:${timestamp}`).digest('hex')
  const headers = new Headers({ 'x-moraplates-push-timestamp': timestamp, 'x-moraplates-push-signature': signature })
  assert.equal(await verifyDispatch(headers, key, now), true)
  assert.equal(await verifyDispatch(headers, key, now + 121000), false)
  assert.equal(await verifyDispatch(headers, null, now), false)
  headers.set('x-moraplates-push-signature', '0'.repeat(64))
  assert.equal(await verifyDispatch(headers, key, now), false)
})

function testWorker({ showNotification, openWindow, windows = [] }) {
  const handlers = new Map()
  runInNewContext(workerSource, {
    URL,
    self: {
      addEventListener: (name, handler) => handlers.set(name, handler),
      registration: { showNotification },
      clients: { matchAll: async () => windows, openWindow },
      location: { origin: 'https://moraplates.example' },
    },
  })
  return (name, event) => new Promise(resolve => handlers.get(name)({ ...event, waitUntil: resolve }))
}

test('the worker shows the reply push and navigates an existing app window', async () => {
  const path = `/posts/${post}?comment=${comment}`
  const shown = []
  const visited = []
  const client = {
    url: 'https://moraplates.example/',
    focused: true,
    navigate: async destination => { visited.push(destination); return client },
    focus: async () => { visited.push('focus') },
  }
  const dispatch = testWorker({
    showNotification: (title, options) => shown.push([title, options]),
    windows: [client],
  })
  await dispatch('push', { data: { json: () => ({ kind: 'reply', id: '123', path }) } })
  assert.equal(shown[0][0], 'MoraPlates')
  assert.equal(shown[0][1].body, 'Someone replied to your comment.')
  assert.equal(shown[0][1].tag, 'moraplates-123')
  assert.equal(shown[0][1].data.path, path)
  await dispatch('notificationclick', { notification: { data: shown[0][1].data, close: () => visited.push('close') } })
  assert.deepEqual(visited, ['close', `https://moraplates.example${path}`, 'focus'])
})

test('the worker still displays invalid push data and only opens a MoraPlates URL', async () => {
  const dispatch = testWorker({
    showNotification: (_title, options) => {
      assert.equal(options.body, 'You have a new notification.')
      assert.equal(options.data.path, '/')
    },
    openWindow: destination => assert.equal(destination, 'https://moraplates.example/'),
  })
  await dispatch('push', { data: { json: () => { throw new SyntaxError() } } })
  await dispatch('notificationclick', { notification: { data: { path: '//elsewhere.example/' }, close() {} } })
})
