// Renders the MoraPlates mark (public/favicon.svg) into the PNG icons the PWA manifest and iOS need.
// Run after changing the logo: node scripts/make-icons.mjs
import { readFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const out = new URL('../public/icons/', import.meta.url)
mkdirSync(out, { recursive: true })

const CREAM = '#FFF4E4'
// [file, size, background, logo share of the canvas]
const ICONS = [
  ['icon-192.png', 192, 'transparent', 0.94],
  ['icon-512.png', 512, 'transparent', 0.94],
  // Maskable icons get cropped to circles/squircles: keep the logo inside the 80% safe zone.
  ['maskable-192.png', 192, CREAM, 0.66],
  ['maskable-512.png', 512, CREAM, 0.66],
  // iOS fills transparency with black, so the home-screen icon sits on cream.
  ['apple-touch-icon.png', 180, CREAM, 0.8],
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [file, size, bg, share] of ICONS) {
  await page.setViewportSize({ width: size, height: size })
  const logo = Math.round(size * share)
  await page.setContent(`<style>html,body{margin:0;width:${size}px;height:${size}px;background:${bg};display:grid;place-items:center}
    svg{width:${logo}px;height:${logo}px}</style>${svg}`)
  await page.screenshot({ path: new URL(file, out).pathname.replace(/^\/([A-Za-z]:)/, '$1'), omitBackground: bg === 'transparent' })
  console.log('wrote', file)
}
await browser.close()
