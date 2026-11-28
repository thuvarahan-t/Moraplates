import { expect, test } from '@playwright/test'
import { startModerationTestServer, supabaseUrl } from './moderation-fixtures'

let server
test.use({ viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true })
test.beforeAll(async () => { server = await startModerationTestServer() })
test.afterAll(async () => { await server?.close() })

test('Find foodies shows 30 profiles per page and resets pagination for a new search', async ({ page }) => {
  const profiles = Array.from({ length: 65 }, (_, index) => ({
    id: `student-${index + 1}`,
    full_name: `${index < 30 ? 'IT' : 'Engineering'} student ${index + 1}`,
  }))
  const requests = []
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route(`${supabaseUrl}/rest/v1/profiles?*`, route => {
    const { searchParams } = new URL(route.request().url())
    const offset = Number(searchParams.get('offset') ?? 0)
    const limit = Number(searchParams.get('limit'))
    const term = searchParams.get('full_name')?.replace(/^ilike\.%|%$/g, '') ?? ''
    const matches = profiles.filter(profile => profile.full_name.toLowerCase().includes(term))
    const rows = matches.slice(offset, offset + limit)
    requests.push({ offset, limit, term, order: searchParams.get('order') })
    return route.fulfill({ json: rows, headers: {
      'content-range': rows.length ? `${offset}-${offset + rows.length - 1}/${matches.length}` : `*/${matches.length}`,
      'access-control-expose-headers': 'content-range',
    } })
  })

  await page.goto(new URL('people', server.resolvedUrls.local[0]).href, { waitUntil: 'domcontentloaded' })
  const rows = page.locator('.people-list .person')
  const pagination = page.getByRole('navigation', { name: 'Foodies pages' })
  const next = pagination.getByRole('button', { name: 'Next page' })
  const previous = pagination.getByRole('button', { name: 'Previous page' })
  await expect(rows).toHaveCount(30)
  await expect(pagination).toContainText('Page 1 of 3')
  await expect(previous).toBeDisabled()

  await next.tap()
  await expect(rows).toHaveCount(30)
  await expect(rows.first()).toHaveAttribute('href', '/u/student-31')
  await expect(pagination).toContainText('Page 2 of 3')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

  await next.tap()
  await expect(rows).toHaveCount(5)
  await expect(rows.first()).toHaveAttribute('href', '/u/student-61')
  await expect(pagination).toContainText('Page 3 of 3')
  await expect(next).toBeDisabled()
  await previous.tap()
  await expect(rows.first()).toHaveAttribute('href', '/u/student-31')

  await page.getByRole('searchbox', { name: 'Search students by name' }).fill('Engineering')
  await expect(pagination).toContainText('Page 1 of 2')
  await expect(rows).toHaveCount(30)
  await expect(rows.first()).toHaveAttribute('href', '/u/student-31')
  await next.tap()
  await expect(rows).toHaveCount(5)
  await expect(rows.last()).toHaveAttribute('href', '/u/student-65')
  await expect(next).toBeDisabled()

  expect(requests.map(({ offset, limit, term }) => [offset, limit, term])).toEqual([
    [0, 30, ''], [30, 30, ''], [60, 30, ''], [0, 30, 'engineering'], [30, 30, 'engineering'],
  ])
  expect(requests.every(request => request.order === 'created_at.desc,id.desc')).toBe(true)
})
