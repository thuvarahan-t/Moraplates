import { expect, test } from '@playwright/test'
import { moderatorId, startModerationTestServer, supabaseUrl, useTestSession } from './moderation-fixtures'

const authorId = 'cd621ec9-f96f-44cf-a884-af6df0dd9bdc'
const postId = '30f51afb-11b0-4b62-81e7-9267db8c853b'
const photoPath = `${authorId}/rice.jpg`
let server
let appUrl

test.beforeAll(async () => {
  server = await startModerationTestServer()
  appUrl = server.resolvedUrls.local[0]
})

test.afterAll(async () => { await server?.close() })

test.beforeEach(async ({ context }) => {
  await context.route('https://fonts.googleapis.com/**', route => route.abort())
})

async function openPost(page, userId) {
  let post = {
    id: postId, user_id: authorId, canteen_id: 'it', rating: 'super', caption: 'Lunch today',
    photo_path: photoPath, created_at: new Date().toISOString(),
    author: { full_name: 'Plate Author' }, food: { name: 'Fried rice', price: 200 }, likes: [], comments: [],
  }
  await useTestSession(page, userId)

  const actions = []
  const removedFiles = []
  await page.route(`${supabaseUrl}/**`, async route => {
    const request = route.request()
    const { pathname } = new URL(request.url())
    const moderator = request.headers().authorization === `Bearer ${moderatorId}`
    if (request.method() === 'HEAD') return route.fulfill({ headers: { 'content-range': '*/0' } })
    if (pathname === '/rest/v1/posts') return route.fulfill({ json: post ? [post] : [] })
    if (pathname === '/rest/v1/profiles') return route.fulfill({ json: { id: userId, full_name: 'Signed-in Student' } })
    if (pathname === '/rest/v1/rpc/is_content_moderator') return route.fulfill({ json: moderator })
    if (pathname === '/rest/v1/rpc/moderate_delete') {
      if (!moderator) return route.fulfill({ status: 403, json: { code: '42501', message: 'Moderation required.' } })
      const action = request.postDataJSON()
      actions.push(action)
      const paths = post?.photo_path ? [post.photo_path] : []
      post = action.kind === 'post_photos' ? { ...post, photo_path: null } : null
      return route.fulfill({ json: paths })
    }
    if (pathname === '/storage/v1/object/photos' && request.method() === 'DELETE') {
      const { prefixes } = request.postDataJSON()
      removedFiles.push(...prefixes)
      return route.fulfill({ json: prefixes.map(name => ({ name })) })
    }
    return route.fulfill({ json: [] })
  })

  await page.goto(new URL(`posts/${postId}`, appUrl).href, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Lunch today', { exact: false })).toBeVisible()
  return { actions, removedFiles }
}

test('guests cannot moderate another student’s post', async ({ page }) => {
  await openPost(page)
  await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0)
})

test('regular students cannot moderate another student’s post', async ({ page }) => {
  const studentId = '4ea0d758-3629-48de-b553-f3634471effc'
  const permission = page.waitForResponse(response => response.url() === `${supabaseUrl}/rest/v1/rpc/is_content_moderator`)
  await openPost(page, studentId)
  const response = await permission
  expect(response.request().headers().authorization).toBe(`Bearer ${studentId}`)
  expect(await response.json()).toBe(false)
  await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0)
})

test('a regular author can still edit and delete their own post', async ({ page }) => {
  await openPost(page, authorId)
  await expect(page.getByRole('button', { name: 'Edit your post' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete your post' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete photo' })).toHaveCount(0)
})

test('a moderator can delete the photo and then the post from its regular page', async ({ page }) => {
  const { actions, removedFiles } = await openPost(page, moderatorId)
  const deletePhoto = page.getByRole('button', { name: 'Delete photo', exact: true })
  const deletePost = page.getByRole('button', { name: 'Delete post', exact: true })
  await expect(deletePhoto).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit your post' })).toHaveCount(0)
  page.once('dialog', dialog => dialog.dismiss())
  await deletePhoto.click()
  expect(actions).toEqual([])

  page.once('dialog', dialog => dialog.accept())
  await deletePhoto.click()
  await expect(deletePhoto).toHaveCount(0)
  await expect(page.locator('.post-media .photo')).toHaveCount(0)
  await expect(page.getByText('Lunch today', { exact: false })).toBeVisible()
  expect(actions).toEqual([{ kind: 'post_photos', p: { id: postId, photo_path: photoPath } }])
  expect(removedFiles).toEqual([photoPath])

  page.once('dialog', dialog => dialog.accept())
  await deletePost.click()
  await expect(page).toHaveURL(appUrl)
  expect(actions).toEqual([
    { kind: 'post_photos', p: { id: postId, photo_path: photoPath } },
    { kind: 'posts', p: { id: postId } },
  ])
  expect(removedFiles).toEqual([photoPath])
})
