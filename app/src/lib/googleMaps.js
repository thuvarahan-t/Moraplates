const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
export const hasGoogleMaps = Boolean(apiKey)
export const googleMapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || 'DEMO_MAP_ID'

let mapsPromise
let authFailed = false
const authListeners = new Set()

export function onGoogleAuthFailure(listener) {
  authListeners.add(listener)
  if (authFailed) listener()
  return () => authListeners.delete(listener)
}

export function loadGoogleMaps() {
  if (mapsPromise) return mapsPromise
  mapsPromise = new Promise((resolve, reject) => {
    const callback = 'moraPlatesGoogleMapsReady'
    const script = document.createElement('script')
    const params = new URLSearchParams({ key: apiKey, v: 'weekly', loading: 'async', callback })
    const previousAuthFailure = window.gm_authFailure
    const timeout = setTimeout(failed, 8000)
    function failed() {
      clearTimeout(timeout)
      script.remove()
      delete window[callback]
      reject(new Error('Google Maps is unavailable'))
    }

    window.gm_authFailure = () => {
      authFailed = true
      authListeners.forEach(listener => listener())
      failed()
      previousAuthFailure?.()
    }
    window[callback] = async () => {
      try {
        const [{ Map }, { AdvancedMarkerElement }, { LatLngBounds }] = await Promise.all([
          window.google.maps.importLibrary('maps'),
          window.google.maps.importLibrary('marker'),
          window.google.maps.importLibrary('core'),
        ])
        clearTimeout(timeout)
        delete window[callback]
        resolve({ Map, AdvancedMarkerElement, LatLngBounds })
      } catch {
        failed()
      }
    }
    script.async = true
    script.onerror = failed
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`
    document.head.append(script)
  })
  return mapsPromise
}
