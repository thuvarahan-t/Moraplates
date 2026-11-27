import { canteenStatusLabel, isOpen, isReportedClosed, isReportedOpen, superPercent, totalRatings } from '../src/lib/food.js'

const MAX_CANTEENS = 80
const MAX_FOODS = 240
const CANTEEN_FIELDS = ['id', 'name', 'location', 'lat', 'lng', 'opens_at', 'closes_at', 'known_for', 'votes_this_week']
const CANTEEN_FIELD_VERSIONS = [
  ['reported_closed_until'],
  ['reported_open_until'],
  ['opens_minute', 'closes_minute', 'reported_closed_today_until', 'last_reported_at', 'last_reported_status'],
]
const FOOD_FIELDS = ['id', 'canteen_id', 'name', 'price', 'super_count', 'okay_count', 'avoid_count']
const COLOMBO_TIME_ZONE = 'Asia/Colombo'

function hourLabel(hour) {
  const minutes = Math.round(hour * 60)
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function toCanteen(row, now) {
  const hours = {
    opensAt: row.opens_minute == null ? row.opens_at : row.opens_minute / 60,
    closesAt: row.closes_minute == null ? row.closes_at : row.closes_minute / 60,
    closedUntil: row.reported_closed_until,
    openUntil: row.reported_open_until,
    closedTodayUntil: row.reported_closed_today_until,
  }
  const closedByReport = isReportedClosed(hours, now)
  const openByReport = isReportedOpen(hours, now)
  const statusOverrideUntil = closedByReport ? hours.closedUntil : openByReport ? hours.openUntil : undefined

  return {
    id: row.id,
    name: row.name,
    location: row.location,
    knownFor: row.known_for || undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    opensAt: hourLabel(hours.opensAt),
    closesAt: hourLabel(hours.closesAt),
    openNow: isOpen(hours, now),
    status: canteenStatusLabel(hours, now),
    statusOverrideUntil,
    lastReportedAt: row.last_reported_at ?? undefined,
    lastReportedStatus: row.last_reported_status ?? undefined,
    votesThisWeek: row.votes_this_week ?? 0,
  }
}

function toFood(row) {
  const ratings = {
    superCount: row.super_count ?? 0,
    okayCount: row.okay_count ?? 0,
    avoidCount: row.avoid_count ?? 0,
  }
  const count = totalRatings(ratings)
  return {
    id: row.id,
    canteenId: row.canteen_id,
    name: row.name,
    priceLkr: row.price,
    ...ratings,
    totalRatings: count,
    superPercent: count ? superPercent(ratings) : null,
  }
}

/** Read the public views using a narrow projection and the same Colombo status logic as the app. */
export async function loadAssistantCatalog({ url, anonKey, fetchImpl = fetch, now = new Date() }) {
  const signal = AbortSignal.timeout(6_000)
  const base = new URL('rest/v1/', `${url.replace(/\/+$/, '')}/`)
  const fetchRows = (view, columns, limit) => {
    const endpoint = new URL(view, base)
    endpoint.search = new URLSearchParams({ select: columns.join(','), order: 'name.asc,id.asc', limit: String(limit) })
    return fetchImpl(endpoint, { signal, headers: { apikey: anonKey, accept: 'application/json' } })
  }

  const readCanteens = async () => {
    let versions = CANTEEN_FIELD_VERSIONS
    while (true) {
      const result = await fetchRows('canteen_standings', CANTEEN_FIELDS.concat(versions.flat()), MAX_CANTEENS + 1)
      if (result.ok) return result.json()
      if (result.status !== 400 || !versions.length) throw new Error('Could not read canteen standings')

      // Older deployments expose earlier versions of this view. Remove only the missing fields.
      const error = await result.json()
      if (!['42703', 'PGRST204'].includes(error.code)) throw new Error('Could not read canteen standings')
      const index = versions.findIndex(fields => fields.some(field => new RegExp(`\\b${field}\\b`).test(error.message)))
      if (index === -1) throw new Error('Could not read canteen standings')
      versions = versions.slice(0, index)
    }
  }

  const readFoods = async () => {
    const result = await fetchRows('food_stats', FOOD_FIELDS, MAX_FOODS + 1)
    if (!result.ok) throw new Error('Could not read food stats')
    return result.json()
  }

  const [canteenRows, foodRows] = await Promise.all([readCanteens(), readFoods()])
  if (!Array.isArray(canteenRows) || !Array.isArray(foodRows)) throw new Error('Could not read the canteen catalog')
  const observedAt = new Date(now)
  const canteens = canteenRows.slice(0, MAX_CANTEENS).map(row => toCanteen(row, observedAt.getTime()))
  const canteenIds = new Set(canteens.map(canteen => canteen.id))
  const foods = foodRows.slice(0, MAX_FOODS).filter(row => canteenIds.has(row.canteen_id)).map(toFood)
  return {
    asOf: observedAt.toISOString(),
    timeZone: COLOMBO_TIME_ZONE,
    truncated: canteenRows.length > MAX_CANTEENS || foodRows.length > MAX_FOODS,
    canteens,
    foods,
  }
}
