// Native share on supported phones; clipboard or selectable URL elsewhere.
export async function shareLink(path, title) {
  const url = new URL(path, window.location.origin).href
  if (navigator.share) {
    try { await navigator.share({ title, url }); return 'shared' }
    catch (err) { if (err.name === 'AbortError') return 'cancelled' }
  }
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(url); return 'copied' } catch {}
  }
  window.prompt('Copy this link', url)
  return 'shown'
}

export const canteenMapLink=c=>c?.lat!=null&&c?.lng!=null?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(c.lat+','+c.lng):'/canteens/'+c?.id

export function canteenDirectionsLink({ lat, lng }) {
  const params = new URLSearchParams({ api: '1', destination: `${lat},${lng}`, travelmode: 'walking' })
  return `https://www.google.com/maps/dir/?${params}`
}
