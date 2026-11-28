import { expect, test } from '@playwright/test'
import { startModerationTestServer, supabaseUrl, useTestSession } from './moderation-fixtures'

const userId = '681d6058-3072-49f7-a319-b7f62ce4ad40'
let server

test.beforeAll(async () => { server = await startModerationTestServer() })
test.afterAll(async () => { await server?.close() })

test('an open session signs out on detection of an account ban', async ({ page }) => {
  await useTestSession(page, userId)
  let status = 'active'
  let logouts = 0
  await page.route(`${supabaseUrl}/**`, route => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/rest/v1/rpc/account_access_status') return route.fulfill({ json: status })
    if (pathname === '/rest/v1/profiles') return route.fulfill({ json: { id: userId, full_name: 'Signed-in Student' } })
    if (pathname === '/auth/v1/logout') {
      logouts += 1
      return route.fulfill({ status: 204 })
    }
    if (route.request().method() === 'HEAD') return route.fulfill({ headers: { 'content-range': '*/0' } })
    return route.fulfill({ json: [] })
  })
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('link', { name: 'Your profile' })).toBeVisible()

  status = 'banned'
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText('This account has been banned from MoraPlates.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Your profile' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveCount(0)
  await expect.poll(() => logouts).toBe(1)
})

test('the sign-in form explains a native account ban', async ({ page }) => {
  await page.route(`${supabaseUrl}/**`, route => {
    if (new URL(route.request().url()).pathname === '/auth/v1/token') {
      return route.fulfill({ status: 400, json: { code: 'user_banned', message: 'User is banned' } })
    }
    return route.fulfill({ json: [] })
  })
  await page.goto(new URL('welcome', server.resolvedUrls.local[0]).href)
  await page.getByPlaceholder('yourname.23').fill('teststudent')
  await page.getByLabel('Password', { exact: true }).fill('example-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('This account has been banned from MoraPlates.')
})
