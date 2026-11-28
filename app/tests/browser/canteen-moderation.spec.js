import { expect, test } from '@playwright/test'
import { moderatorId, startModerationTestServer, supabaseUrl, useTestSession } from './moderation-fixtures.js'

const uploaderId = '91155a09-b728-4a6a-9004-ac74e378a99c'
const otherStudentId = '748cc2c5-9c17-4189-804a-447c21ccf0d6'
const foodId = 'e23d3e59-f157-46d5-8316-67463999349a'
const coverPath = `${uploaderId}/cover.jpg`
const menuPhotoPath = `${uploaderId}/menu.jpg`
let server
let appUrl

test.use({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } })

test.beforeAll(async () => {
  server = await startModerationTestServer()
  appUrl = server.resolvedUrls.local[0]
})

test.afterAll(async () => { await server?.close() })

async function mockCanteen(page, userId) {
  let canteen = {
    id: 'it', name: 'IT canteen', location: 'Near the IT faculty', colour: '#E8492F',
    opens_at: 6, closes_at: 21, votes_this_week: 5, photo_path: coverPath,
    last_reported_status: 'closed', last_reported_at: new Date().toISOString(),
  }
  let food = { id: foodId, canteen_id: 'it', name: 'Cheese kottu', price: 550, photo_path: menuPhotoPath }
  let gallery = Array.from({ length: 14 }, (_, i) => ({
    id: `2ddcebc0-60a6-4d0e-9fec-85236e7192${String(i).padStart(2, '0')}`,
    canteen_id: 'it', user_id: uploaderId, photo_path: `${uploaderId}/gallery-${i + 1}.jpg`,
    created_at: new Date(Date.now() - i * 1000).toISOString(), author: { full_name: `Uploader ${i + 1}` },
  }))
  const initialGallery = gallery
  const actions = []
  const removedFiles = []
  if (userId) await useTestSession(page, userId)

  await page.route(`${supabaseUrl}/**`, async route => {
    const request = route.request()
    const { pathname, searchParams } = new URL(request.url())
    const moderator = request.headers().authorization === `Bearer ${moderatorId}`
    if (request.method() === 'HEAD') return route.fulfill({ headers: { 'content-range': '*/0' } })
    switch (pathname) {
      case '/rest/v1/profiles':
        return route.fulfill({ json: searchParams.has('id') ? { id: userId, full_name: 'Signed-in Student' } : [] })
      case '/rest/v1/rpc/is_content_moderator':
        return route.fulfill({ json: moderator })
      case '/rest/v1/rpc/my_vote':
        return route.fulfill({ json: null })
      case '/rest/v1/canteen_standings':
        return route.fulfill({ json: canteen ? [canteen] : [] })
      case '/rest/v1/food_stats':
        return route.fulfill({ json: food ? [food] : [] })
      case '/rest/v1/canteens':
        return route.fulfill({ json: canteen ? [{ photos: gallery.slice(0, 5) }] : [] })
      case '/rest/v1/canteen_photos': {
        const offset = Number(searchParams.get('offset'))
        const limit = Number(searchParams.get('limit')) || 30
        return route.fulfill({ json: gallery.slice(offset, offset + limit) })
      }
      case '/rest/v1/rpc/moderate_delete': {
        if (!moderator) return route.fulfill({ status: 403, json: { code: '42501', message: 'Moderation required.' } })
        const action = request.postDataJSON()
        actions.push(action)
        const { id, photo_path } = action.p
        if (action.kind === 'canteen_photos') gallery = gallery.filter(photo => photo.id !== id)
        if (action.kind === 'canteen_covers') canteen = { ...canteen, photo_path: null }
        if (action.kind === 'food_photos') food = { ...food, photo_path: null }
        if (action.kind === 'canteen_status_reports') canteen = { ...canteen, last_reported_status: null, last_reported_at: null }
        if (action.kind === 'foods') food = null
        if (action.kind === 'canteens') canteen = null
        return route.fulfill({ json: photo_path ? [photo_path] : [] })
      }
      case '/storage/v1/object/photos': {
        const { prefixes } = request.postDataJSON()
        removedFiles.push(...prefixes)
        return route.fulfill({ json: prefixes.map(name => ({ name })) })
      }
      default:
        return route.fulfill({ json: [] })
    }
  })
  return { actions, removedFiles, initialGallery }
}

async function confirmClick(page, button) {
  page.once('dialog', dialog => dialog.accept())
  await button.click()
}

test('students can only remove their own canteen slideshow photo', async ({ page, context }) => {
  await mockCanteen(page, otherStudentId)
  await page.goto(new URL('canteens/it', appUrl).href)
  await expect(page.getByRole('heading', { name: 'IT canteen' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Delete|^Manage canteen photos|^Clear reports/ })).toHaveCount(0)

  const owner = await context.newPage()
  await mockCanteen(owner, uploaderId)
  await owner.goto(new URL('canteens/it', appUrl).href)
  await expect(owner.getByRole('button', { name: 'Delete this photo' })).toBeVisible()
  await expect(owner.getByRole('button', { name: 'Delete canteen' })).toHaveCount(0)
})

test('a moderator can remove canteen content from the regular pages', async ({ page }) => {
  const { actions, removedFiles, initialGallery } = await mockCanteen(page, moderatorId)
  await page.goto(appUrl)
  const slideshow = page.getByRole('region', { name: 'Canteen slideshow' })
  const homeRemove = slideshow.getByRole('button', { name: 'Delete slideshow photo for IT canteen' })
  await expect(homeRemove).toBeVisible()
  page.once('dialog', dialog => dialog.dismiss())
  await homeRemove.click()
  expect(actions).toEqual([])
  await confirmClick(page, homeRemove)
  await expect(slideshow.getByText('📷 Uploader 1', { exact: true })).toHaveCount(0)

  await page.goto(new URL('canteens/it', appUrl).href)
  await expect(page.getByRole('button', { name: 'Delete this photo' })).toBeVisible()
  const openManager = page.getByRole('button', { name: 'Manage canteen photos' })
  await openManager.click()
  const manager = page.getByRole('dialog', { name: 'Manage canteen photos' })
  await confirmClick(page, manager.getByRole('button', { name: 'Delete canteen cover photo' }))
  await expect(manager.getByRole('button', { name: 'Delete canteen cover photo' })).toHaveCount(0)
  await manager.getByRole('button', { name: 'Next photos' }).click()
  const olderPhoto = manager.getByRole('button', { name: 'Delete gallery photo 13 by Uploader 14' })
  await confirmClick(page, olderPhoto)
  await expect(olderPhoto).toHaveCount(0)
  await manager.getByRole('button', { name: 'Done' }).click()

  const clearReports = page.getByRole('button', { name: 'Clear reports' })
  await confirmClick(page, clearReports)
  await expect(clearReports).toHaveCount(0)

  await page.getByRole('link', { name: /Cheese kottu/ }).click()
  const deleteMenuPhoto = page.getByRole('button', { name: 'Delete menu photo' })
  await confirmClick(page, deleteMenuPhoto)
  await expect(deleteMenuPhoto).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Cheese kottu' })).toBeVisible()
  await page.getByRole('link', { name: 'IT canteen', exact: true }).click()

  await confirmClick(page, page.getByRole('button', { name: 'Delete Cheese kottu' }))
  await expect(page.getByRole('link', { name: /Cheese kottu/ })).toHaveCount(0)
  await confirmClick(page, page.getByRole('button', { name: 'Delete canteen' }))
  await expect(page).toHaveURL(new URL('canteens', appUrl).href)
  expect(actions).toEqual([
    { kind: 'canteen_photos', p: { id: initialGallery[0].id, photo_path: initialGallery[0].photo_path } },
    { kind: 'canteen_covers', p: { id: 'it', photo_path: coverPath } },
    { kind: 'canteen_photos', p: { id: initialGallery[13].id, photo_path: initialGallery[13].photo_path } },
    { kind: 'canteen_status_reports', p: { id: 'it' } },
    { kind: 'food_photos', p: { id: foodId, photo_path: menuPhotoPath } },
    { kind: 'foods', p: { id: foodId } },
    { kind: 'canteens', p: { id: 'it' } },
  ])
  expect(removedFiles).toEqual([initialGallery[0].photo_path, coverPath, initialGallery[13].photo_path, menuPhotoPath])
})
