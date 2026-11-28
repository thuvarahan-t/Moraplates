/* MoraPlates service worker: makes the app installable and keeps the shell working on weak campus Wi-Fi.
   - Page navigations: network first, cached app shell when offline (the SPA router takes it from there).
   - Built assets (/assets/*, hashed by Vite) and icons: cache first, they never change under the same name.
   - Google Fonts: stale-while-revalidate.
   - Supabase (data, auth, photos) and every other request: untouched, always live. */
const VERSION = 'v7'
const SHELL = `moraplates-shell-${VERSION}`
const STATIC = `moraplates-static-${VERSION}`
const FONTS = `moraplates-fonts-${VERSION}`
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE)))
})

self.addEventListener('activate', event => {
  const keep = new Set([SHELL, STATIC, FONTS])
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('moraplates-') && !keep.has(key)) await caches.delete(key)
    await self.clients.claim()
  })())
})

// The page asks a waiting worker to take over when the person taps "Update".
self.addEventListener('message', event => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

const PUSH_MESSAGES = {
  follow: 'Someone followed you.',
  like: 'Someone liked your post.',
  reply: 'Someone replied to your comment.',
}
const PUSH_PATH = /^\/(?:u|posts)\/[0-9a-f-]{36}(?:\?comment=[0-9a-f-]{36})?$/i

function notificationPath(path) {
  return typeof path === 'string' && PUSH_PATH.test(path) ? path : '/'
}

self.addEventListener('push', event => {
  let payload
  try { payload = event.data?.json() } catch { /* Show a generic notification for an unreadable payload. */ }
  const kind = payload?.kind
  event.waitUntil(self.registration.showNotification('MoraPlates', {
    body: Object.hasOwn(PUSH_MESSAGES, kind) ? PUSH_MESSAGES[kind] : 'You have a new notification.',
    icon: '/icons/icon-192.png',
    tag: /^\d+$/.test(payload?.id) ? `moraplates-${payload.id}` : 'moraplates',
    data: { path: notificationPath(payload?.path) },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const destination = new URL(notificationPath(event.notification.data?.path), self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find(client => client.url === destination) || windows.find(client => client.focused) || windows[0]
    if (existing) {
      const target = existing.url === destination ? existing : await existing.navigate(destination).catch(() => null)
      if (target) return target.focus()
    }
    return self.clients.openWindow(destination)
  })())
})

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL)
  try {
    const res = await fetch(request)
    if (res.ok) cache.put('/index.html', res.clone())
    return res
  } catch {
    return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error()
  }
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

async function staleWhileRevalidate(request, name) {
  const cache = await caches.open(name)
  const hit = await cache.match(request)
  const fresh = fetch(request).then(res => {
    if (res.ok || res.type === 'opaque') cache.put(request, res.clone())
    return res
  }).catch(() => hit)
  return hit || fresh
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') return event.respondWith(networkFirstPage(request))
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname === '/favicon.svg')
      return event.respondWith(cacheFirst(request, STATIC))
    return
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com')
    return event.respondWith(staleWhileRevalidate(request, FONTS))
})
