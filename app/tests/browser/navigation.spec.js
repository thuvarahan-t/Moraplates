import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 667 }, isMobile: true, hasTouch: true })

test('mobile navigation stays in place when switching from Canteens to Profile', async ({ page }) => {
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
  await expect(canteens).toHaveAttribute('aria-current', 'page')
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

  const before = await nav.evaluate(bar => {
    const layout = () => [bar, ...bar.querySelectorAll('a, button')].map(element => {
      const { x, y, width, height } = element.getBoundingClientRect()
      return [x, y, width, height]
    })
    bar.addEventListener('pointerdown', () => {
      window.tabLayout = new Promise(resolve => {
        const frames = [layout()]
        const capture = () => {
          frames.push(layout())
          if (frames.length < 30) requestAnimationFrame(capture)
          else resolve(frames)
        }
        requestAnimationFrame(capture)
      })
    }, { once: true })
    return layout()
  })

  await profile.tap()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(profile).toHaveAttribute('aria-current', 'page')
  await expect(canteens).not.toHaveAttribute('aria-current', 'page')

  const layouts = await page.evaluate(() => window.tabLayout)
  expect(layouts).toHaveLength(30)
  expect(new Set(layouts.map(layout => JSON.stringify(layout)))).toEqual(new Set([JSON.stringify(before)]))
  expect(await page.evaluate(() => window.tabViewTransitions)).toBe(0)
})
