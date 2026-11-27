import { expect, test } from '@playwright/test'

test('home slideshow can select a canteen and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const slideshow = page.getByRole('region', { name: 'Canteen slideshow' })
  await expect(slideshow.getByRole('button', { name: 'Show canteen 1' })).toHaveAttribute('aria-current', 'true')
  await expect(page.locator('.brand-wordmark')).toHaveCSS('animation-name', 'none')
  await slideshow.getByRole('button', { name: 'Show canteen 2' }).click()
  await expect(slideshow.getByRole('button', { name: 'Show canteen 2' })).toHaveAttribute('aria-current', 'true')
  await slideshow.getByRole('link', { name: 'Main canteen, see the canteen' }).click()
  await expect(page).toHaveURL(/\/canteens\/main$/)
})

test('food links show only that food’s plates and handle empty menus', async ({ page }) => {
  await page.goto('/canteens/it')
  await page.getByRole('link', { name: /^Chicken kottu/ }).click()
  await expect(page).toHaveURL(/\/canteens\/it\/foods\/kottu$/)
  await expect(page.getByRole('heading', { name: 'Chicken kottu' })).toBeVisible()
  await expect(page.locator('.social-post .post-food b')).toHaveText(['Chicken kottu'])
  await page.getByRole('button', { name: 'Post this plate' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Chicken kottu', { exact: true }).first()).toBeVisible()

  await page.goto('/canteens/it/foods/efr')
  await expect(page.getByRole('heading', { name: 'No plates yet' })).toBeVisible()
  await page.goto('/canteens/main/foods/kottu')
  await expect(page.getByRole('heading', { name: 'Food not found' })).toBeVisible()
})

test('three personal canteen pins are saved, ordered first and removable', async ({ page }) => {
  await page.goto('/canteens')
  for (const name of ['Civil canteen', 'Hostel canteen', 'Juice bar']) {
    const pin = page.getByRole('button', { name: `Pin ${name}` })
    await pin.click()
    await expect(pin).toHaveAttribute('aria-pressed', 'true')
  }
  const fourth = page.getByRole('button', { name: 'Pin Main canteen' })
  await fourth.click()
  await expect(page.locator('#toast')).toContainText('You can pin up to 3 canteens')
  await expect(fourth).toHaveAttribute('aria-pressed', 'false')
  await page.reload()
  const names = page.locator('.canteen-list-item .cn')
  await expect(names).toHaveText(['Civil canteen', 'Hostel canteen', 'Juice bar', 'IT canteen', 'Main canteen'])
  await page.getByRole('button', { name: 'Pin Hostel canteen' }).click()
  await fourth.click()
  await expect(names).toHaveText(['Civil canteen', 'Juice bar', 'Main canteen', 'IT canteen', 'Hostel canteen'])
})

test('the campus map opens Google Maps without a configured API key', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort())
  await page.goto('/canteens')
  await page.getByRole('button', { name: 'Map', exact: true }).click()
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open in Google Maps' }))
    .toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=6.7958%2C79.9008')
})

test.describe('mobile tab drag', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('preview follows a held touch across tabs and commits on release', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main' })
    const touch = await page.context().newCDPSession(page)
    const point = async label => {
      const box = await nav.getByRole('link', { name: label }).boundingBox()
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    }
    const feed = await point('Feed')
    const top = await point('Top')
    const profile = await point('Profile')
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [feed] })
    await expect(nav).toHaveClass(/is-dragging/)
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [top] })
    await expect(nav.getByRole('link', { name: 'Top' })).toHaveAttribute('data-preview', 'true')
    await expect(nav.getByRole('link', { name: 'Feed' })).toHaveAttribute('aria-current', 'page')
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [profile] })
    await expect(nav.getByRole('link', { name: 'Profile' })).toHaveAttribute('data-preview', 'true')
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page).toHaveURL(/\/profile$/)
    await expect(nav.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    await expect(nav).not.toHaveClass(/is-dragging/)
  })
})
