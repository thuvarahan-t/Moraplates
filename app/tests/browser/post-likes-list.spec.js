import { expect, test } from '@playwright/test'
import { startModerationTestServer, supabaseUrl, useTestSession } from './moderation-fixtures'

const postId = '30f51afb-11b0-4b62-81e7-9267db8c853b'
const authorId = 'cd621ec9-f96f-44cf-a884-af6df0dd9bdc'
const viewerId = '4ea0d758-3629-48de-b553-f3634471effc'
let server

test.use({ viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true })
test.beforeAll(async () => { server = await startModerationTestServer() })
test.afterAll(async () => { await server?.close() })

async function openPost(page, viewer) {
  await useTestSession(page, viewer)
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  const liker = { id: authorId, full_name: 'First Liker', faculty: 'IT' }
  const viewerProfile = { id: viewerId, full_name: 'Signed-in Student' }
  let liked = false
  let finishSave
  const saving = new Promise(resolve => { finishSave = resolve })
  const listRequests = []
  await page.route(`${supabaseUrl}/**`, async route => {
    const request = route.request()
    const { pathname } = new URL(request.url())
    if (request.method() === 'HEAD') return route.fulfill({ headers: { 'content-range': '*/0' } })
    if (pathname === '/rest/v1/posts') return route.fulfill({ json: [{
      id: postId, user_id: authorId, canteen_id: 'it', rating: 'super', caption: 'Lunch today',
      created_at: new Date().toISOString(), author: { full_name: 'Plate Author' },
      food: { name: 'Fried rice', price: 200 }, likes: [{ count: liked ? 2 : 1 }], comments: [],
    }] })
    if (pathname === '/rest/v1/profiles') return route.fulfill({ json: viewerProfile })
    if (pathname === '/rest/v1/rpc/is_content_moderator') return route.fulfill({ json: false })
    if (pathname === '/rest/v1/likes' && request.method() === 'POST') {
      await saving
      liked = true
      return route.fulfill({ status: 201, json: [] })
    }
    if (pathname === '/rest/v1/rpc/post_liker_list') {
      listRequests.push(request.postDataJSON())
      return route.fulfill({ json: liked ? [liker, viewerProfile] : [liker] })
    }
    return route.fulfill({ json: [] })
  })
  await page.goto(new URL(`posts/${postId}`, server.resolvedUrls.local[0]).href, { waitUntil: 'domcontentloaded' })
  return { finishSave, listRequests }
}

test('visitors can open a post’s liker list without toggling the heart', async ({ page }) => {
  const { listRequests } = await openPost(page)
  await page.getByRole('button', { name: 'View 1 like', exact: true }).tap()
  const dialog = page.getByRole('dialog', { name: 'Likes' })
  await expect(dialog.getByRole('link', { name: /First Liker/ })).toHaveAttribute('href', `/u/${authorId}`)
  expect(listRequests[0]).toEqual({ target: postId, after_id: null, page_size: 25 })
  await dialog.getByRole('button', { name: 'Close likes' }).tap()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Like plate', exact: true })).toHaveAttribute('aria-pressed', 'false')
})

test('opening the liker list waits for a like that is still saving', async ({ page }) => {
  const { finishSave, listRequests } = await openPost(page, viewerId)
  const saving = page.waitForRequest(request => request.url() === `${supabaseUrl}/rest/v1/likes` && request.method() === 'POST')
  await page.getByRole('button', { name: 'Like plate', exact: true }).tap()
  await saving
  await page.getByRole('button', { name: 'View 2 likes', exact: true }).tap()
  const dialog = page.getByRole('dialog', { name: 'Likes' })
  try {
    await expect(dialog.getByText('Loading people…')).toBeVisible()
    expect(listRequests).toHaveLength(0)
  } finally {
    finishSave()
  }
  await expect(dialog.getByRole('link', { name: /Signed-in Student/ })).toBeVisible()
})
