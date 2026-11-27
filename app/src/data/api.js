import { supabase } from '../lib/supabase'
import { SAMPLE_CANTEENS, SAMPLE_FOODS, SAMPLE_PLATES_TODAY } from './sample'

import { fetchCanteenStandings, fetchFoodStats } from './queries'

/** Midnight today in Colombo (UTC+5:30, no DST), as an ISO string. */
function startOfColomboDay() {
  const offset = 330 * 60_000
  const local = new Date(Date.now() + offset)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offset).toISOString()
}

/** Data for the Home page, sharing catalog reads with the rankings. */
export async function fetchHome(cache) {
  const [canteens, foods, today] = await Promise.all([
    cache.load('canteen-standings', fetchCanteenStandings),
    cache.load('food-stats', fetchFoodStats),
    supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', startOfColomboDay()),
  ])
  if (today.error) throw today.error
  return {
    canteens,
    foods,
    platesToday: today.count ?? 0,
  }
}

export function sampleHome() {
  return { canteens: SAMPLE_CANTEENS, foods: SAMPLE_FOODS, platesToday: SAMPLE_PLATES_TODAY }
}
