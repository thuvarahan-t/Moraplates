import { supabase } from '../lib/supabase'
import { SAMPLE_CANTEENS, SAMPLE_FOODS, SAMPLE_PLATES_TODAY } from './sample'

import { toCanteen, toFood } from './queries'

/** Midnight today in Colombo (UTC+5:30, no DST), as an ISO string. */
function startOfColomboDay() {
  const offset = 330 * 60_000
  const local = new Date(Date.now() + offset)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offset).toISOString()
}

/** Data for the Home page, or null when there is no Supabase project (use sampleHome()). */
export async function fetchHome() {
  const [canteens, foods, today] = await Promise.all([
    supabase.from('canteen_standings').select('*'),
    supabase.from('food_stats').select('*'),
    supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', startOfColomboDay()),
  ])
  const error = canteens.error || foods.error || today.error
  if (error) throw error
  return {
    canteens: canteens.data.map(toCanteen),
    foods: foods.data.map(toFood),
    platesToday: today.count ?? 0,
  }
}

export function sampleHome() {
  return { canteens: SAMPLE_CANTEENS, foods: SAMPLE_FOODS, platesToday: SAMPLE_PLATES_TODAY }
}
