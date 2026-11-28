import { expect, test } from '@playwright/test'
import { startModerationTestServer, supabaseUrl, useTestSession } from './moderation-fixtures'

const viewerId = 'ddd5053c-51d4-4fcb-8cfb-3d6fb163461a'
const authorId = '2bb531db-c73c-488a-b6e9-85fce27169db'
const followedId = '0ffa7440-baa5-4f92-914b-39a0c3eca0c9'

let server
test.use({ viewport: { width: 375, height: 812 } })
test.beforeAll(async () => { server = await startModerationTestServer() })
test.afterAll(async () => { await server?.close() })

test('feed follows stay in sync across an author’s posts and recover from a failed write', async ({ page }) => {
  await useTestSession(page, viewerId)
  await page.addInitScript(() => { delete window.IntersectionObserver })
  await page.route('https://fonts.googleapis.com/**', route => route.abort())

  const posts = [
    ['01', authorId, 'Plate Author'], ['02', authorId, 'Plate Author'],
    ['03', followedId, 'Followed Student'], ['04', viewerId, 'Signed-in Student'],
  ].map(([id, userId, fullName]) => ({
    id, user_id: userId, canteen_id: 'it', rating: 'super', caption: 'Lunch today',
    created_at: new Date().toISOString(), author: { full_name: fullName }, food: { name: 'Fried rice', price: 200 },
    likes: [], comments: [],
  }))
  const followed = new Set([followedId])
  const followReads = []
  const followWrites = []

  await page.route(`${supabaseUrl}/**`, async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'HEAD') return route.fulfill({ headers: { 'content-range': '*/0' } })
    if (url.pathname === '/rest/v1/posts') return route.fulfill({ json: posts })
    if (url.pathname === '/rest/v1/profile_follows') {
      if (request.method() === 'POST') {
        const { followed_id } = request.postDataJSON()
        followWrites.push(followed_id)
        if (followWrites.length === 1) return route.fulfill({ status: 500, json: { message: 'Follow write failed' } })
        followed.add(followed_id)
        return route.fulfill({ status: 201, body: '' })
      }
      followReads.push(url.searchParams.get('followed_id'))
      expect(url.searchParams.get('follower_id')).toBe(`eq.${viewerId}`)
      return route.fulfill({ json: [...followed].map(followed_id => ({ followed_id })) })
    }
    if (url.pathname === '/rest/v1/profiles' && request.headers().accept?.includes('object+json')) {
      return route.fulfill({ json: { id: viewerId, full_name: 'Signed-in Student' } })
    }
    return route.fulfill({ json: [] })
  })

  await page.goto(server.resolvedUrls.local[0])
  const follow = page.getByRole('button', { name: 'Follow Plate Author' })
  await expect(follow).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Follow Followed Student' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Follow Signed-in Student' })).toHaveCount(0)
  expect(followReads[0].match(new RegExp(authorId, 'g'))).toHaveLength(1)
  expect(followReads[0]).toContain(followedId)

  await follow.first().click()
  await expect(page.getByText('Follow write failed')).toBeVisible()
  await expect(follow).toHaveCount(2)
  await follow.last().click()
  await expect(page.getByText('Following Plate Author')).toBeVisible()
  await expect(follow).toHaveCount(0)
  expect(followWrites).toEqual([authorId, authorId])

  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByText('Lunch today')).toHaveCount(4)
  await expect(follow).toHaveCount(0)
})
