import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test('password visibility can be toggled in both account forms', async ({ page }) => {
  await page.goto('/welcome')

  const password = page.getByLabel(/^Password/)
  const showPassword = page.getByRole('button', { name: 'Show password' })
  const hidePassword = page.getByRole('button', { name: 'Hide password' })
  const plate = page.locator('.password-field .password-plate')

  await expect(password).toHaveAttribute('type', 'password')
  await expect(plate).toHaveAttribute('data-open', 'false')
  await expect(plate.locator('.password-plate-lid')).toHaveCount(1)
  await password.fill('sample-password')
  await showPassword.tap()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(plate).toHaveAttribute('data-open', 'true')
  await expect(password).toHaveValue('sample-password')
  await hidePassword.press('Space')
  await expect(password).toHaveAttribute('type', 'password')
  await expect(plate).toHaveAttribute('data-open', 'false')

  await showPassword.tap()
  await page.getByRole('tab', { name: 'Create account' }).tap()
  await expect(password).toHaveAttribute('type', 'password')
  await expect(plate).toHaveAttribute('data-open', 'false')
  await showPassword.tap()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(plate).toHaveAttribute('data-open', 'true')
  await hidePassword.tap()
  await expect(password).toHaveAttribute('type', 'password')
  await expect(plate).toHaveAttribute('data-open', 'false')
})

test('forgot password opens the code flow from sign in and goes back', async ({ page }) => {
  await page.goto('/welcome')
  await page.getByPlaceholder('yourname.23').fill('kavin.23')
  await page.getByRole('button', { name: 'Forgot password?' }).tap()
  await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible()
  // the username typed on the sign-in form carries over
  await expect(page.getByPlaceholder('yourname.23')).toHaveValue('kavin.23')
  await page.getByRole('button', { name: 'Back to sign in' }).tap()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Create account' })).toBeVisible()
  // no reset link on the create-account form
  await page.getByRole('tab', { name: 'Create account' }).tap()
  await expect(page.getByRole('button', { name: 'Forgot password?' })).toHaveCount(0)
})
