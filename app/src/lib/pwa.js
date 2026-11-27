import { useEffect, useState } from 'react'

// Install + update state for the PWA, shared by every component that asks.
// Chrome, Edge, Samsung Internet and other Chromium browsers fire `beforeinstallprompt`, so we can show our own
// Install button. Safari (iPhone/iPad/Mac) never does; there the person adds the app from the Share menu,
// so we show short instructions instead.

const state = { prompt: null, installed: false, updateReady: null }
const subs = new Set()
const emit = () => subs.forEach(fn => fn({ ...state }))

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
export const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
export const isSafariMac = /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua) && !isIOS
export const isStandalone = () =>
  typeof window !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true)

export function registerPWA() {
  if (typeof window === 'undefined') return
  state.installed = isStandalone()

  addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    state.prompt = e
    emit()
  })
  addEventListener('appinstalled', () => {
    state.prompt = null
    state.installed = true
    emit()
  })

  // Dev keeps Vite's hot reload untouched; the worker only runs on built sites.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const offer = w => { state.updateReady = w; emit() }
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const w = reg.installing
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w)
        })
      })
      // Check for a new build when the person comes back to the app.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) })
    } catch { /* installability is a bonus; the site works without it */ }
  })
  let reloading = false
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (reloading || !state.updateReady) return
    reloading = true
    location.reload()
  })
}

export async function promptInstall() {
  const p = state.prompt
  if (!p) return 'unavailable'
  p.prompt()
  const { outcome } = await p.userChoice
  state.prompt = null
  if (outcome === 'accepted') state.installed = true
  emit()
  return outcome
}

export function applyUpdate() {
  state.updateReady?.postMessage('skip-waiting')
}

export function usePWA() {
  const [s, set] = useState(() => ({ ...state }))
  useEffect(() => {
    subs.add(set)
    set({ ...state })
    return () => { subs.delete(set) }
  }, [])
  return {
    ...s,
    // What kind of install help this browser can get, or null when it's installed or can't install.
    installKind: s.installed || isStandalone() ? null : s.prompt ? 'prompt' : isIOS ? 'ios' : isSafariMac ? 'mac-safari' : null,
  }
}
