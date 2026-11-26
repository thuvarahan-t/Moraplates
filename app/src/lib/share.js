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
