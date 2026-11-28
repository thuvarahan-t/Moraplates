import { expect, test } from '@playwright/test'
import { startModerationTestServer, supabaseUrl, useTestSession } from './moderation-fixtures'

const profileId = 'cd621ec9-f96f-44cf-a884-af6df0dd9bdc'
const followingId = '0496ce72-396e-4e8e-aad2-9d58789e8d52'
const followers = Array.from({ length: 25 }, (_, index) => ({
  id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  full_name: `Follower ${index + 1}`,
}))
const followed = { id: followingId, full_name: 'Followed Student' }
let server
let appUrl

test.use({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } })

test.beforeAll(async () => {
  server = await startModerationTestServer()
  appUrl = server.resolvedUrls.local[0]
})

test.afterAll(async () => { await server?.close() })

async function openProfile(page, own) {
  const requests = []
  await useTestSession(page, own ? profileId : null)
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route(`${supabaseUrl}/**`, async route => {
    const request = route.request()
    const { pathname, searchParams } = new URL(request.url())
    if (pathname === '/rest/v1/profiles') {
      const id = searchParams.get('id')?.slice(3)
      const profile = id === followingId ? followed : { id: profileId, full_name: 'Student Profile' }
      return route.fulfill({ json: profile })
    }
    if (pathname === '/rest/v1/rpc/profile_follow_summary') {
      return route.fulfill({ json: { followers: 25, following: 1, viewer_follows: false } })
    }
    if (pathname === '/rest/v1/rpc/profile_follow_list') {
      const payload = request.postDataJSON()
      requests.push(payload)
      const rows = payload.direction === 'followers' ? followers : [followed]
      return route.fulfill({ json: rows.filter(person => !payload.after_id || person.id > payload.after_id).slice(0, payload.page_size) })
    }
    if (pathname === '/rest/v1/rpc/my_vote') {
      return route.fulfill({ body: 'null', contentType: 'application/json' })
    }
    return route.fulfill({ json: [] })
  })
  await page.goto(new URL(own ? 'profile' : `u/${profileId}`, appUrl).href, { waitUntil: 'domcontentloaded' })
  return requests
}

test('guests can open both public lists and page through followers', async ({ page }) => {
  const requests = await openProfile(page, false)
  await page.getByRole('button', { name: '25 followers' }).click()
  const followerList = page.getByRole('dialog', { name: 'Followers' })
  await expect(followerList.getByRole('link')).toHaveCount(24)
  await followerList.getByRole('button', { name: 'Load more' }).click()
  await expect(followerList.getByRole('link', { name: /^Follower 25$/ })).toBeVisible()
  await expect(followerList.getByRole('button', { name: 'Load more' })).toHaveCount(0)
  expect(requests).toContainEqual({ target: profileId, direction: 'followers', after_id: followers[23].id, page_size: 25 })
  await page.keyboard.press('Escape')
  await expect(followerList).toHaveCount(0)

  await page.getByRole('button', { name: '1 following' }).click()
  const followingList = page.getByRole('dialog', { name: 'Following' })
  const followedProfile = followingList.getByRole('link', { name: 'Followed Student' })
  await expect(followedProfile).toBeVisible()
  await followedProfile.click()
  await expect(page).toHaveURL(new URL(`u/${followingId}`, appUrl).href)
  await expect(followingList).toHaveCount(0)
})

test('signed-in students can open the lists on their own profile', async ({ page }) => {
  await openProfile(page, true)
  await page.getByRole('button', { name: '1 following' }).click()
  const dialog = page.getByRole('dialog', { name: 'Following' })
  await expect(dialog.getByRole('link', { name: 'Followed Student' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close following' }).click()
  await expect(dialog).toHaveCount(0)
})
