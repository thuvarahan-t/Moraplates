import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 800 } })

test('desktop closure has one direct report action', async ({ page }) => {
  await page.goto('/canteens/it')

  const closure = page.locator('.closure-box')
  await expect(closure.getByRole('button')).toHaveCount(1)
  await closure.getByRole('button', { name: 'Report closed today', exact: true }).click()
  await expect(page.locator('#toast')).toHaveText('Demo mode: connect Supabase to make changes.')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
