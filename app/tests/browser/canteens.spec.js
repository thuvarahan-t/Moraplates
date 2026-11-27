import { expect, test } from '@playwright/test'
import { SAMPLE_CANTEENS } from '../../src/data/sample.js'

test('canteen bars show shares of all weekly votes, including while filtering', async ({ page }) => {
  await page.goto('/canteens')

  const totalVotes = SAMPLE_CANTEENS.reduce((total, canteen) => total + canteen.votes, 0)
  const cards = page.locator('.canteen-list-item')
  await expect(cards).toHaveCount(SAMPLE_CANTEENS.length)
  for (const { name, votes } of SAMPLE_CANTEENS) {
    const percentage = Math.round(100 * votes / totalVotes)
    const card = cards.filter({ has: page.getByText(name, { exact: true }) })
    await expect(card.getByText(`${percentage}% of votes`, { exact: true })).toBeVisible()
    await expect(card.locator('.bar i')).toHaveCSS('--w', `${percentage}%`)
  }

  const top = SAMPLE_CANTEENS[0]
  await page.getByRole('searchbox', { name: 'Search a food or canteen' }).fill(top.name)
  await expect(cards).toHaveCount(1)
  await expect(cards.getByText(`${Math.round(100 * top.votes / totalVotes)}% of votes`, { exact: true })).toBeVisible()
})

test('the canteen photo placeholder starts the add-photo action', async ({ page }) => {
  await page.goto('/canteens/it')

  const placeholder = page.locator('.canteen-photo-placeholder').getByRole('button', { name: 'Add photo' })
  await placeholder.click()
  await expect(page.locator('#toast')).toHaveText('Demo mode: connect Supabase to make changes.')
})
