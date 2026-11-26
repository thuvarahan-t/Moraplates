// Rating and canteen maths, ported from index.html (tot, pc, sup, cSup, isOpen, hr, rtOf).

export const totalRatings = f => f.superCount + f.okayCount + f.avoidCount
export const percent = (f, key) => (totalRatings(f) ? Math.round((f[key] / totalRatings(f)) * 100) : 0)
export const superPercent = f => percent(f, 'superCount')

export const byVotes = (a, b) => b.votes - a.votes

/** % Super across all of a canteen's foods. */
export function canteenSuper(foods) {
  const t = foods.reduce((n, f) => n + totalRatings(f), 0)
  return t ? Math.round((foods.reduce((n, f) => n + f.superCount, 0) / t) * 100) : 0
}

export const isOpen = c => { const h = new Date().getHours(); return h >= c.opensAt && h < c.closesAt }
export const hourLabel = h => (h === 0 || h === 24 ? '12am' : h === 12 ? '12pm' : h > 12 ? h - 12 + 'pm' : h + 'am')

/** Rating chip for a food: [css class, label]. No ratings yet -> neutral chip. */
export function ratingChip(f) {
  if (!totalRatings(f)) return ['', 'No ratings yet']
  const s = superPercent(f)
  return [s >= 70 ? 'sup' : s >= 50 ? 'ok' : 'av2', s + '% Super']
}
