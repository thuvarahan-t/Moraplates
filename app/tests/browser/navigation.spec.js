import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 667 }, isMobile: true, hasTouch: true })

test('mobile navigation slides the active pill while the bar stays in place', async ({ page }) => {
  await page.addInitScript(() => {
    window.tabViewTransitions = 0
    const startViewTransition = document.startViewTransition?.bind(document)
    if (startViewTransition) {
      document.startViewTransition = (...args) => {
        window.tabViewTransitions++
        return startViewTransition(...args)
      }
    }
  })
  await page.goto('/canteens')

  const nav = page.getByRole('navigation', { name: 'Main' })
  const canteens = nav.getByRole('link', { name: 'Canteens' })
  const profile = nav.getByRole('link', { name: 'Profile' })
  const pill = nav.locator('.bnav-pill')
  await expect(canteens).toHaveAttribute('aria-current', 'page')
  await expect.poll(async () => Math.abs((await pill.boundingBox()).x - (await canteens.boundingBox()).x)).toBeLessThan(1)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

  const before = await nav.evaluate(bar => {
    const pill = bar.querySelector('.bnav-pill')
    const layout = () => [bar, ...bar.querySelectorAll('a, button')].map(element => {
      const { x, y, width, height } = element.getBoundingClientRect()
      return [x, y, width, height]
    })
    const frame = () => ({ layout: layout(), pillX: pill.getBoundingClientRect().x })
    bar.addEventListener('pointerdown', () => {
      window.tabLayout = new Promise(resolve => {
        const frames = [frame()]
        const capture = () => {
          frames.push(frame())
          if (frames.length < 30) requestAnimationFrame(capture)
          else resolve(frames)
        }
        requestAnimationFrame(capture)
      })
    }, { once: true })
    return frame()
  })

  await profile.tap()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(profile).toHaveAttribute('aria-current', 'page')
  await expect(canteens).not.toHaveAttribute('aria-current', 'page')

  const layouts = await page.evaluate(() => window.tabLayout)
  expect(layouts).toHaveLength(30)
  expect(new Set(layouts.map(frame => JSON.stringify(frame.layout)))).toEqual(new Set([JSON.stringify(before.layout)]))
  const targetX = (await profile.boundingBox()).x
  expect(layouts.some(frame => frame.pillX > before.pillX + 1 && frame.pillX < targetX - 1)).toBe(true)
  await expect.poll(async () => Math.abs((await pill.boundingBox()).x - targetX)).toBeLessThan(1)
  expect(await page.evaluate(() => window.tabViewTransitions)).toBe(0)
})

test('mobile tab highlight jumps to the selected tab with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/canteens')

  const nav = page.getByRole('navigation', { name: 'Main' })
  const profile = nav.getByRole('link', { name: 'Profile' })
  const pill = nav.locator('.bnav-pill')
  await profile.tap()
  await expect(profile).toHaveAttribute('aria-current', 'page')
  await expect(pill).toHaveCSS('transition-property', 'none')
  expect(Math.abs((await pill.boundingBox()).x - (await profile.boundingBox()).x)).toBeLessThan(1)
})

test('tapping the active Feed tab returns to the top and refreshes plates', async ({ page }) => {
  await page.goto('/')
  const cards = page.locator('.social-post')
  const first = cards.first()
  await expect(first).toBeVisible()
  const food = await first.locator('.post-food b').innerText()
  await first.evaluate(card => card.scrollIntoView({ block: 'center' }))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('moraplates:seen:v1:guest'))).not.toBeNull()

  const feed = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Feed' })
  await feed.tap()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await expect(cards.first().locator('.post-food b')).not.toHaveText(food)
})
