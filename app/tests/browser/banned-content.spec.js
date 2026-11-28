import { expect, test } from '@playwright/test'
import { startModerationTestServer, supabaseUrl } from './moderation-fixtures'

const userId = '132dedbc-1759-4866-9aac-fbfbbd0752ad'
const postId = 'ed065c33-c4ab-46df-9be6-af0bd8ab80b7'
let server
test.beforeAll(async () => { server = await startModerationTestServer() })
test.afterAll(async () => { await server?.close() })

test('open profiles refresh after a ban and saved post links become unavailable', async ({ page }) => {
  let banned = false
  let revision = 0
  const profile = { id: userId, full_name: 'Hidden Student' }
  const post = {
    id: postId, user_id: userId, canteen_id: 'wala', rating: 'super', caption: 'A distinctive plate caption',
    author: profile, food: { name: 'Meal', price: 150 }, likes: [], comments: [], created_at: new Date().toISOString(),
  }
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route(`${supabaseUrl}/**`, route => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/rest/v1/rpc/content_visibility_version') return route.fulfill({ json: revision })
    if (route.request().method() === 'HEAD') return route.fulfill({ headers: { 'content-range': '*/0' } })
    if (pathname === '/rest/v1/profiles') return route.fulfill({ json: banned ? [] : [profile] })
    if (pathname === '/rest/v1/posts') return route.fulfill({ json: banned ? [] : [post] })
    return route.fulfill({ json: [] })
  })
  const appUrl = server.resolvedUrls.local[0]
  await page.goto(new URL(`u/${userId}`, appUrl).href, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: "Hidden's plates", exact: true })).toBeVisible()

  banned = true
  revision += 1
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('heading', { name: 'Student not found' })).toBeVisible()
  await expect(page.getByText(profile.full_name, { exact: true })).toHaveCount(0)

  await page.goto(new URL(`posts/${postId}`, appUrl).href, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Plate unavailable' })).toBeVisible()
  await expect(page.getByText(post.caption)).toHaveCount(0)

  banned = false
  revision += 1
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText(post.caption)).toBeVisible()
})
