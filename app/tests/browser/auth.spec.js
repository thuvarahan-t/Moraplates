import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test('password visibility can be toggled in both account forms', async ({ page }) => {
  await page.goto('/welcome')

  const password = page.getByLabel(/^Password/)
  const showPassword = page.getByRole('button', { name: 'Show password' })
  const hidePassword = page.getByRole('button', { name: 'Hide password' })

  await expect(password).toHaveAttribute('type', 'password')
  await password.fill('sample-password')
  await showPassword.tap()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(password).toHaveValue('sample-password')
  await hidePassword.press('Space')
  await expect(password).toHaveAttribute('type', 'password')

  await showPassword.tap()
  await page.getByRole('tab', { name: 'Create account' }).tap()
  await expect(password).toHaveAttribute('type', 'password')
  await showPassword.tap()
  await expect(password).toHaveAttribute('type', 'text')
  await hidePassword.tap()
  await expect(password).toHaveAttribute('type', 'password')
})
