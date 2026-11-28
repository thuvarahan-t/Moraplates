import { expect, test } from '@playwright/test'
import { moderatorId, startModerationTestServer, supabaseUrl, useTestSession } from './moderation-fixtures.js'

const adminId = 'a0372166-7314-42ec-aaf2-5502a2ca5c7d'
const accountId = '78ce051b-3779-4f45-ab2a-cac614e0953e'
const email = 'teststudent@uom.lk'
let server
let appUrl

test.use({ viewport: { width: 390, height: 844 } })

test.beforeAll(async () => {
  server = await startModerationTestServer()
  appUrl = server.resolvedUrls.local[0]
})

test.afterAll(async () => { await server?.close() })

async function mockAccounts(page, viewerId) {
  await useTestSession(page, viewerId)
  const account = { id: accountId, email, full_name: 'Test Student', banned: false, is_admin: false }
  const admin = { id: adminId, email: 'owner@uom.lk', full_name: 'Site Owner', banned: false, is_admin: true }
  const actions = []
  const searches = []
  const lookups = []
  await page.route(`${supabaseUrl}/**`, async route => {
    const request = route.request()
    const { pathname, searchParams } = new URL(request.url())
    const isAdmin = request.headers().authorization === `Bearer ${adminId}`
    if (request.method() === 'HEAD') return route.fulfill({ headers: { 'content-range': '*/0' } })
    if (pathname === '/rest/v1/profiles') {
      const id = searchParams.get('id')?.replace(/^eq\./, '')
      if (id === accountId) return route.fulfill({ json: [{ id, full_name: account.full_name, faculty: 'IT' }] })
      return route.fulfill({ json: { id: viewerId, full_name: 'Signed-in User' } })
    }
    if (pathname === '/rest/v1/rpc/is_admin') return route.fulfill({ json: isAdmin })
    if (pathname === '/rest/v1/rpc/is_content_moderator') return route.fulfill({ json: true })
    if (pathname === '/rest/v1/rpc/account_access_status') return route.fulfill({ json: 'active' })
    if (pathname === '/rest/v1/rpc/admin_list_accounts') {
      searches.push(request.postDataJSON())
      const { search_term, page_offset } = searches.at(-1)
      const result = [account, admin].filter(row => [row.id, row.email, row.full_name].some(value => value.includes(search_term)))
      return route.fulfill({ json: result.slice(page_offset, page_offset + 51) })
    }
    if (pathname === '/rest/v1/rpc/admin_get_account') {
      const lookup = request.postDataJSON()
      lookups.push(lookup)
      if (!isAdmin) return route.fulfill({ status: 403, json: { message: 'Administrator access required' } })
      return route.fulfill({ json: lookup.target_user_id === accountId ? account : null })
    }
    if (pathname === '/rest/v1/rpc/admin_set_account_ban') {
      const action = request.postDataJSON()
      actions.push(action)
      if (!isAdmin || action.target_user_id !== accountId)
        return route.fulfill({ status: 403, json: { message: 'Administrator access required' } })
      account.banned = action.banned
      return route.fulfill({ json: null })
    }
    return route.fulfill({ json: [] })
  })
  return { searches, actions, lookups }
}

test('administrator can find, ban and unban a student account', async ({ page }) => {
  const { searches, actions } = await mockAccounts(page, adminId)
  await page.goto(new URL('admin', appUrl).href)
  await page.getByLabel('Resource').selectOption('accounts')
  const admin = page.getByRole('article').filter({ hasText: 'owner@uom.lk' })
  await expect(admin.getByText('Administrator', { exact: true })).toBeVisible()
  await expect(admin.getByRole('button')).toHaveCount(0)

  await page.getByRole('searchbox', { name: 'Search accounts' }).fill(email)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(admin).toHaveCount(0)
  await expect.poll(() => searches.at(-1)).toEqual({ search_term: email, page_offset: 0 })

  const account = page.getByRole('article').filter({ hasText: email })
  const ban = account.getByRole('button', { name: `Ban ${email}` })
  await expect(account.getByText('Active', { exact: true })).toBeVisible()
  page.once('dialog', dialog => dialog.dismiss())
  await ban.click()
  expect(actions).toEqual([])

  page.once('dialog', dialog => dialog.accept())
  await ban.click()
  await expect(account.getByText('Banned', { exact: true })).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await account.getByRole('button', { name: `Unban ${email}` }).click()
  await expect(account.getByText('Active', { exact: true })).toBeVisible()
  expect(actions).toEqual([
    { target_user_id: accountId, banned: true },
    { target_user_id: accountId, banned: false },
  ])
})

test('content moderators cannot open administrator account management', async ({ page }) => {
  const { searches, actions } = await mockAccounts(page, moderatorId)
  await page.goto(new URL('admin', appUrl).href)
  await expect(page.getByRole('heading', { name: 'Admin access required' })).toBeVisible()
  await expect(page.getByLabel('Resource')).toHaveCount(0)
  expect(searches).toEqual([])
  expect(actions).toEqual([])
})

test('administrator can see the university email and ban from a student’s profile', async ({ page }) => {
  const { lookups, actions } = await mockAccounts(page, adminId)
  await page.goto(new URL(`u/${accountId}`, appUrl).href)
  const panel = page.getByRole('region', { name: 'Account administration' })
  await expect(panel.getByText(email, { exact: false })).toBeVisible()
  expect(lookups).toContainEqual({ target_user_id: accountId })

  page.once('dialog', dialog => dialog.accept())
  await panel.getByRole('button', { name: `Ban ${email}` }).click()
  await expect(panel.getByText('Banned', { exact: true })).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await panel.getByRole('button', { name: `Unban ${email}` }).click()
  await expect(panel.getByText('Active', { exact: true })).toBeVisible()
  expect(actions).toEqual([
    { target_user_id: accountId, banned: true },
    { target_user_id: accountId, banned: false },
  ])
})

for (const [viewer, id] of [['guest', undefined], ['content moderator', moderatorId]]) {
  test(`${viewer} cannot see or request private account details on a profile`, async ({ page }) => {
    const { lookups } = await mockAccounts(page, id)
    await page.goto(new URL(`u/${accountId}`, appUrl).href)
    await expect(page.getByRole('heading', { name: "Test's plates" })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Account administration' })).toHaveCount(0)
    await expect(page.getByText(email)).toHaveCount(0)
    expect(lookups).toEqual([])
  })
}
