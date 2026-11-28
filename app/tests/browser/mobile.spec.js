import {test,expect} from '@playwright/test'
import { SAMPLE_POSTS } from '../../src/data/sample.js'
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'dark'})
test('all demo routes render in light mode without page errors or horizontal overflow',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  for(const route of ['/','/canteens','/canteens/it','/canteens/new','/top','/profile','/welcome','/people','/u/demo-kavins','/posts/1','/admin']){
    await page.goto(route)
    await expect(page.locator('main')).toBeVisible()
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme)).toBe('light')
  }
  await expect(page.getByText('Admin access required',{exact:true})).toBeVisible()
  expect(errors).toEqual([])
})

test('canteen details offer one inline closure report on mobile', async ({ page }) => {
  await page.goto('/canteens/it')
  const closure = page.locator('.closure-box')
  await expect(closure.getByText('Help students plan their visit with a closure report.')).toBeVisible()
  await expect(closure.getByRole('button')).toHaveCount(1)
  await expect(closure.getByRole('button', { name: 'Report closed today', exact: true })).toBeVisible()
})

test('feed likes, shares and seen history; a viewed plate remains on author profile',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.sharedURL=data.url}})})
  await page.goto('/')
  const first=page.locator('.social-post').first()
  await expect(first).toBeVisible()
  const author=await first.locator('.post-author-link').getAttribute('href')
  const like=first.getByRole('button',{name:'Like plate',exact:true})
  await like.click()
  await expect(first.getByRole('button',{name:'Unlike plate',exact:true})).toBeVisible()
  await first.getByRole('button',{name:'Share post',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>window.sharedURL)).toContain('/posts/')
  await first.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1300)
  const shared=await page.evaluate(()=>window.sharedURL)
  await page.getByRole('button',{name:'Refresh',exact:true}).click()
  await expect.poll(async()=>page.locator('.social-post').count()).toBeLessThan(7)
  await page.goto(author)
  await expect(page.locator('.mine a').filter({hasText:'Chicken kottu'}).or(page.locator('.mine a').first()).first()).toBeVisible()
  await page.goto(shared)
  await expect(page.locator('.social-post')).toBeVisible()
})

test('home greets the viewer by first name using Colombo time', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-27T03:30:00Z'))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Good morning, Sahan' })).toBeVisible()

  await page.clock.setFixedTime(new Date('2026-11-27T13:30:00Z'))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Good evening, Sahan' })).toBeVisible()
})

test('feed dropdowns fit on mobile and filter and sort the plates', async ({ page }) => {
  await page.addInitScript(ids => {
    localStorage.setItem('moraplates:seen:v1:guest', JSON.stringify(ids))
  }, SAMPLE_POSTS.map(([id]) => String(id)))
  await page.goto('/')

  const canteen = page.getByRole('combobox', { name: 'Canteen', exact: true })
  const sort = page.getByRole('combobox', { name: 'Sort posts', exact: true })
  const feed = page.locator('#feed')
  const food = feed.locator('.post-food b')
  await expect(canteen).toBeVisible()
  await expect(sort).toBeVisible()
  await expect(canteen).toHaveAccessibleDescription('All canteens')
  await expect(sort).toHaveAccessibleDescription('Latest')

  const [canteenBox, sortBox] = await Promise.all([canteen.boundingBox(), sort.boundingBox()])
  expect(canteenBox.x).toBeGreaterThanOrEqual(0)
  expect(canteenBox.x + canteenBox.width).toBeLessThanOrEqual(sortBox.x)
  expect(Math.abs(canteenBox.y - sortBox.y)).toBeLessThanOrEqual(1)
  expect(sortBox.x + sortBox.width).toBeLessThanOrEqual(390)

  const canteenMenu = page.getByRole('listbox', { name: 'Canteen', exact: true })
  await canteen.tap()
  await expect(canteenMenu.getByRole('option', { name: 'All canteens', selected: true })).toBeVisible()
  const menuBox = await canteenMenu.boundingBox()
  expect(menuBox.x).toBeGreaterThanOrEqual(0)
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(390)
  await canteenMenu.getByRole('option', { name: 'IT canteen', exact: true }).tap()
  await expect(canteenMenu).toBeHidden()
  await expect(canteen).toHaveAccessibleDescription('IT canteen')
  await expect(feed.locator('.post-location')).toHaveText(['IT canteen', 'IT canteen', 'IT canteen'])
  await expect(food).toHaveText(['Chicken kottu', 'Fish bun', 'Cheese kottu'])

  const sortMenu = page.getByRole('listbox', { name: 'Sort posts', exact: true })
  await sort.press('ArrowDown')
  await expect(sortMenu.getByRole('option', { name: 'Latest', selected: true })).toBeVisible()
  await sort.press('End')
  await sort.press('Enter')
  await expect(sortMenu).toBeHidden()
  await expect(sort).toHaveAccessibleDescription('Most liked')
  await expect(sort).toBeFocused()
  await expect(food).toHaveText(['Chicken kottu', 'Cheese kottu', 'Fish bun'])

  await canteen.press('ArrowDown')
  await expect(canteenMenu.getByRole('option', { name: 'IT canteen', selected: true })).toBeVisible()
  await canteen.press('Escape')
  await expect(canteenMenu).toBeHidden()
  await expect(canteen).toBeFocused()

  await canteen.tap()
  await canteenMenu.getByRole('option', { name: 'All canteens', exact: true }).tap()
  await expect(food).toHaveCount(SAMPLE_POSTS.length)
  await expect(food.first()).toHaveText('Faluda')
})

test('the last canteen option stays tappable above the navigation on a short phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 450 })
  await page.goto('/')

  const canteen = page.getByRole('combobox', { name: 'Canteen', exact: true })
  await canteen.tap()
  await canteen.press('End')

  const option = page.getByRole('option', { name: 'Hostel canteen', exact: true })
  await expect.poll(() => option.evaluate(row => {
    const { x, y, width, height } = row.getBoundingClientRect()
    return row.contains(document.elementFromPoint(x + width / 2, y + height / 2))
  })).toBe(true)
  await option.tap()
  await expect(canteen).toHaveAccessibleDescription('Hostel canteen')
})

test('scrolling past the last unseen plate appends history below it', async ({ page }) => {
  await page.addInitScript(() => {
    const key = 'moraplates:seen:v1:guest'
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(['1', '2', '3', '4', '5', '6']))
  })
  await page.goto('/')

  const cards = page.locator('#feed .social-post')
  const caughtUp = page.getByRole('heading', { name: "You're all caught up" })
  await expect(cards).toHaveCount(1)
  await expect(cards.first().locator('.post-food')).toContainText('Cheese kottu')
  await expect(caughtUp).toHaveCount(0)

  await page.locator('.feed-page-status').scrollIntoViewIfNeeded()
  await expect(caughtUp).toBeVisible()
  await expect(cards).toHaveCount(7)
  await expect(cards.first().locator('.post-food')).toContainText('Cheese kottu')
  await expect(cards.nth(1).locator('.post-food')).toContainText('Chicken kottu')
  await expect(page.locator('#feed .posts > .social-post + .feed-caught-up')).toHaveCount(1)

  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(caughtUp).toBeVisible()
  await expect(cards).toHaveCount(7)

  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Canteen', exact: true })).toBeVisible()
  await expect(caughtUp).toBeVisible()
  await expect(cards).toHaveCount(7)
})

test('profile search and native photo crop preview work on phone',async({page})=>{
  await page.goto('/profile')
  await page.getByRole('searchbox',{name:'Search students by name'}).fill('Kavin')
  await page.getByRole('link',{name:/Kavin S/}).click()
  await expect(page.locator('.mine a').first()).toBeVisible()
  await page.goto('/')
  await page.getByRole('button',{name:'Post your plate',exact:true}).last().click()
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=400;const ctx=c.getContext('2d');ctx.fillStyle='#d97706';ctx.fillRect(0,0,600,400);return c.toDataURL('image/png').split(',')[1]})
  await page.getByLabel('Photo of your plate',{exact:true}).setInputFiles({name:'food.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')})
  // selected straight away, as taken; the editor only opens from the pencil
  const plate=page.getByAltText('Your plate',{exact:true})
  await expect(plate).toBeVisible()
  await expect(page.getByLabel('Crop photo',{exact:true})).toHaveCount(0)
  await expect.poll(()=>plate.evaluate(i=>i.naturalWidth/i.naturalHeight)).toBe(1.5)
  await page.getByRole('button',{name:'Edit photo',exact:true}).click()
  await expect(page.getByLabel('Crop photo',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Square',exact:true}).click()
  await expect.poll(()=>page.locator('canvas.crop-preview').evaluate(c=>c.width/c.height)).toBe(1)
  await page.getByRole('button',{name:'Done',exact:true}).click()
  await expect.poll(()=>plate.evaluate(i=>i.naturalWidth/i.naturalHeight)).toBe(1)
  // reopening continues from the last edit
  await page.getByRole('button',{name:'Edit photo',exact:true}).click()
  await expect(page.getByRole('button',{name:'Square',exact:true})).toHaveAttribute('aria-pressed','true')
  await page.getByRole('button',{name:'Cancel',exact:true}).click()
  await expect(plate).toBeVisible()
})
