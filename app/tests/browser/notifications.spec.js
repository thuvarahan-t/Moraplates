import { expect, test } from '@playwright/test'
import { startModerationTestServer, supabaseUrl, useTestSession } from './moderation-fixtures'

const userId = '4ea0d758-3629-48de-b553-f3634471effc'
const actorId = 'cd621ec9-f96f-44cf-a884-af6df0dd9bdc'
const postId = '30f51afb-11b0-4b62-81e7-9267db8c853b'
let server

test.use({ viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true })
test.beforeAll(async () => { server = await startModerationTestServer() })
test.afterAll(async () => { await server?.close() })

async function openFeed(page, viewerId) {
  await useTestSession(page, viewerId)
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  const now = new Date().toISOString()
  const actor = { id: actorId, full_name: 'Plate Friend', avatar_path: null }
  const rows = [
    { id: 2, recipient_id: userId, actor_id: actorId, kind: 'like', post_id: postId, created_at: now, read_at: null, actor },
    { id: 1, recipient_id: userId, actor_id: actorId, kind: 'follow', post_id: null, created_at: now, read_at: null, actor },
  ]
  let noticeReads = 0
  let arrivalDuringMarkAll
  await page.route(`${supabaseUrl}/**`, async route => {
    const request = route.request()
    const { pathname, searchParams } = new URL(request.url())
    if (pathname === '/rest/v1/notifications') {
      const unread = () => rows.filter(row => row.read_at === null)
      if (request.method() === 'PATCH') {
        const id = searchParams.get('id')
        if (id?.startsWith('lte.') && arrivalDuringMarkAll) {
          rows.unshift(arrivalDuringMarkAll)
          arrivalDuringMarkAll = null
        }
        const updated = unread().filter(row => !id || (id.startsWith('lte.') ? row.id <= Number(id.slice(4)) : id === `eq.${row.id}`))
        for (const row of updated) row.read_at = request.postDataJSON().read_at
        return route.fulfill({ json: updated })
      }
      noticeReads += 1
      if (request.method() === 'HEAD') return route.fulfill({ headers: {
        'content-range': `*/${unread().length}`,
        'access-control-expose-headers': 'content-range',
      } })
      return route.fulfill({ json: rows })
    }
    if (request.method() === 'HEAD') return route.fulfill({ headers: { 'content-range': '*/0' } })
    if (pathname === '/rest/v1/rpc/is_content_moderator') return route.fulfill({ json: false })
    if (pathname === '/rest/v1/profiles') return route.fulfill({ json: { id: userId, full_name: 'Signed-in Student' } })
    return route.fulfill({ json: [] })
  })
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded' })
  return { rows, noticeReads: () => noticeReads, queueArrival: row => { arrivalDuringMarkAll = row } }
}

test('guests do not load private notifications', async ({ page }) => {
  const { noticeReads } = await openFeed(page)
  await expect(page.getByRole('heading', { name: 'Fresh plates' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveCount(0)
  expect(noticeReads()).toBe(0)
})

test('students can open, read, and clear their follow and like notifications', async ({ page }) => {
  const { rows, queueArrival } = await openFeed(page, userId)
  await page.getByRole('button', { name: 'Notifications, 2 unread' }).press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Notifications' })
  const like = dialog.getByRole('link', { name: /Plate Friend liked your post/ })
  await expect(like).toHaveAttribute('href', `/posts/${postId}`)
  await expect(dialog.getByRole('link', { name: /Plate Friend followed you/ })).toHaveAttribute('href', `/u/${actorId}`)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Notifications, 2 unread' })).toBeFocused()

  await page.getByRole('button', { name: 'Notifications, 2 unread' }).tap()
  await like.tap()
  await expect(page).toHaveURL(new RegExp('/posts/' + postId + '$'))
  await expect.poll(() => !!rows[0].read_at).toBe(true)
  expect(rows[1].read_at).toBeNull()

  await page.getByRole('button', { name: 'Notifications, 1 unread' }).tap()
  await expect(dialog.getByRole('link', { name: /Plate Friend followed you/ })).toBeVisible()
  const lateArrival = { ...rows[1], id: 3, actor: { ...rows[1].actor, full_name: 'New Arrival' } }
  queueArrival(lateArrival)
  await dialog.getByRole('button', { name: 'Mark all as read' }).tap()
  await expect(dialog.getByRole('link', { name: /New Arrival followed you/ })).toBeVisible()
  expect(lateArrival.read_at).toBeNull()
  await expect(dialog.getByText('Unread', { exact: true })).toHaveCount(1)

  await dialog.getByRole('button', { name: 'Mark all as read' }).tap()
  await expect(dialog.getByText('Unread', { exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Mark all as read' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close notifications' }).tap()
  await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible()
})

test('a private update refreshes the unread badge while the list is closed', async ({ page }) => {
  let subscription
  await page.routeWebSocket(`${supabaseUrl.replace(/^https:/, 'wss:')}/realtime/v1/websocket**`, socket => {
    socket.onMessage(raw => {
      const message = JSON.parse(raw)
      if (message.event === 'phx_join') subscription = { socket, ...message }
      if (message.event === 'phx_join' || message.event === 'heartbeat') {
        socket.send(JSON.stringify({ topic: message.topic, event: 'phx_reply', ref: message.ref,
          payload: { status: 'ok', response: {} } }))
      }
    })
  })

  const { rows } = await openFeed(page, userId)
  await expect(page.getByRole('button', { name: 'Notifications, 2 unread' })).toBeVisible()
  await expect.poll(() => subscription?.topic).toBe(`realtime:notifications:${userId}`)
  expect(subscription.payload.config.private).toBe(true)

  rows.unshift({ ...rows[0], id: 3 })
  subscription.socket.send(JSON.stringify({ topic: subscription.topic, event: 'broadcast', ref: null,
    payload: { type: 'broadcast', event: 'changed', payload: {} } }))

  await expect(page.getByRole('button', { name: 'Notifications, 3 unread' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toHaveCount(0)
})
