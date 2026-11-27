// Rating and canteen maths, ported from index.html (tot, pc, sup, cSup, isOpen, hr, rtOf).

export const DEFAULT_CANTEEN_HOURS = { opensAt: 6, closesAt: 21 }

export const totalRatings = f => f.superCount + f.okayCount + f.avoidCount
export const percent = (f, key) => (totalRatings(f) ? Math.round((f[key] / totalRatings(f)) * 100) : 0)
export const superPercent = f => percent(f, 'superCount')

export const byVotes = (a, b) => b.votes - a.votes

/** % Super across all of a canteen's foods. */
export function canteenSuper(foods) {
  const t = foods.reduce((n, f) => n + totalRatings(f), 0)
  return t ? Math.round((foods.reduce((n, f) => n + f.superCount, 0) / t) * 100) : 0
}

export const isReportedClosed = (c, now = Date.now()) => !!c.closedUntil && Date.parse(c.closedUntil) > now
export const isReportedOpen = (c, now = Date.now()) => !!c.openUntil && Date.parse(c.openUntil) > now
export const isOpen = (c, now = Date.now()) => {
  if (isReportedClosed(c, now)) return false
  if (isReportedOpen(c, now)) return true
  const local = new Date(now + 330 * 60_000)
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes()
  return minute >= Math.round(c.opensAt * 60) && minute < Math.round(c.closesAt * 60)
}
export function hourLabel(hour) {
  const minutes = Math.round(hour * 60) % 1440
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''}${h >= 12 ? 'pm' : 'am'}`
}

export function canteenStatusLabel(canteen, now = Date.now()) {
  if (isReportedClosed(canteen, now)) return Date.parse(canteen.closedTodayUntil) > now ? 'Closed today' : 'Closed now'
  if (isReportedOpen(canteen, now)) return 'Opened'
  return isOpen(canteen, now) ? 'Open now' : 'Closed'
}

const reportTime = new Intl.DateTimeFormat('en-LK', {
  timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'short', hour12: true,
})

export function lastReportLabel(canteen) {
  const timestamp = Date.parse(canteen.lastReportedAt)
  if (!Number.isFinite(timestamp)) return null
  return `Last reported ${canteen.lastReportedStatus} on ${reportTime.format(timestamp)} (Colombo time)`
}

export function withPrimaryPhoto(canteen, photos) {
  const primary = canteen.primaryPhoto
  if (!primary) return photos
  return [photos.find(photo => photo.id === primary.id) ?? primary, ...photos.filter(photo => photo.id !== primary.id)]
}

/** Rating chip for a food: [css class, label]. No ratings yet -> neutral chip. */
export function ratingChip(f) {
  if (!totalRatings(f)) return ['', 'No ratings yet']
  const s = superPercent(f)
  return [s >= 70 ? 'sup' : s >= 50 ? 'ok' : 'av2', s + '% Super']
}
