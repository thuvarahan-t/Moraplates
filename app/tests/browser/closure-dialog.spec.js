import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 800 } })

test('desktop closure options open in a blurred, dismissible dialog', async ({ page }) => {
  await page.goto('/canteens/it')

  const trigger = page.locator('.closure-box').getByRole('button', { name: 'Report closed', exact: true })
  const dialog = page.getByRole('dialog', { name: 'Report closed', exact: true })

  await expect(dialog).toBeHidden()
  await trigger.click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Report closed', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Report closed today', exact: true })).toBeVisible()
  const backdropFilter = await dialog.evaluate(element => getComputedStyle(element, '::backdrop').backdropFilter)
  expect(backdropFilter).toMatch(/blur\([1-9][\d.]*px\)/)

  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()

  await trigger.press('Enter')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()

  await trigger.click()
  await expect(dialog).toBeVisible()
  await page.mouse.click(8, 8)
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})
