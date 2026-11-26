// Local fallback for guest feeds and temporary network failures. No post content is stored.
const key = uid => 'moraplates:seen:v1:' + (uid || 'guest')
export function readSeen(uid) {
  try { return new Set(JSON.parse(localStorage.getItem(key(uid)) || '[]')) }
  catch { return new Set() }
}
export function rememberSeen(uid, id) {
  const seen = readSeen(uid)
  seen.add(String(id))
  try { localStorage.setItem(key(uid), JSON.stringify([...seen].slice(-3000))) } catch {}
}
