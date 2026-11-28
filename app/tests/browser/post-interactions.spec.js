import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test('double-tapping a post replays the plate animation and likes it once', async ({ page }) => {
  await page.addInitScript(() => {
    window.taps = []
    window.likeSounds = 0
    window.plateReactions = 0
    document.addEventListener('animationstart', event => {
      if (event.animationName === 'plate-reaction-pop') window.plateReactions += 1
    })
    Object.defineProperty(navigator, 'vibrate', { value: duration => window.taps.push(duration) })
    const createOscillator = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function () {
      window.likeSounds += 1
      return createOscillator.call(this)
    }
  })
  await page.goto('/posts/1')
  const media = page.locator('.post-media')
  const likes = page.locator('.post-like-count')
  const like = page.getByRole('button', { name: 'Like plate', exact: true })
  const original = Number(await likes.innerText())
  await media.tap()
  await expect(like).toHaveAttribute('aria-pressed', 'false')
  await media.tap()
  const unlike = page.getByRole('button', { name: 'Unlike plate', exact: true })
  await expect(unlike).toBeVisible()
  await expect(likes).toHaveText(String(original + 1))
  await expect.poll(() => page.evaluate(() => window.plateReactions)).toBe(1)
  await media.tap()
  await media.tap()
  await expect(likes).toHaveText(String(original + 1))
  await expect.poll(() => page.evaluate(() => window.plateReactions)).toBe(2)
  expect(await page.evaluate(() => window.taps)).toEqual([12])
  await expect.poll(() => page.evaluate(() => window.likeSounds)).toBe(1)
  await unlike.tap()
  await expect(likes).toHaveText(String(original))
  await like.tap()
  await expect(likes).toHaveText(String(original + 1))
  await expect.poll(() => page.evaluate(() => window.plateReactions)).toBe(3)
})

test('the post editor preserves tall photos and offers each requested crop', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Post your plate', exact: true }).last().tap()
  const image = '<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960"><rect width="100%" height="100%" fill="orange"/></svg>'
  await page.getByLabel('Photo of your plate', { exact: true }).setInputFiles({
    name: 'portrait.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(image),
  })
  const photo = page.getByAltText('Your plate', { exact: true })
  await expect.poll(() => photo.evaluate(image => image.naturalWidth / image.naturalHeight)).toBe(9 / 16)
  await page.getByRole('button', { name: 'Edit photo', exact: true }).tap()
  const canvas = page.locator('canvas.crop-preview')
  for (const [name, ratio] of [['Square', 1], ['4:5', 4 / 5], ['3:4', 3 / 4], ['16:9', 16 / 9], ['9:16', 9 / 16]]) {
    await page.getByRole('button', { name, exact: true }).tap()
    await expect.poll(() => canvas.evaluate(image => image.width / image.height)).toBeCloseTo(ratio, 2)
  }
})
