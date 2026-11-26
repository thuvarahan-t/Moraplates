import { createClient } from '@supabase/supabase-js'

// Hosting dashboards sometimes keep stray spaces or quotes around pasted values.
const clean = v => (v ?? '').trim().replace(/^["']|["']$/g, '').trim()
const url = clean(import.meta.env.VITE_SUPABASE_URL)
const key = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)

/** Why the Supabase settings can't be used, in plain words, or null when they're fine (or absent). Never includes the values. */
function checkConfig() {
  if (!url && !key) return null // no project: the app runs on sample data
  if (!url) return 'VITE_SUPABASE_URL is missing.'
  if (!key) return 'VITE_SUPABASE_ANON_KEY is missing.'
  if (/^(sb_|eyJ)/.test(url)) return 'VITE_SUPABASE_URL contains a key. Put the project URL there and the key in VITE_SUPABASE_ANON_KEY.'
  let parsed
  try { parsed = new URL(url) } catch { return "VITE_SUPABASE_URL isn't a web address. It should look like https://your-project.supabase.co" }
  if (!/^https?:$/.test(parsed.protocol)) return 'VITE_SUPABASE_URL must start with https://'
  if (/^https?:/.test(key)) return 'VITE_SUPABASE_ANON_KEY contains a URL. The two values look swapped.'
  if (/^(sbp_|sb_secret_)/.test(key)) return 'VITE_SUPABASE_ANON_KEY is a private admin key. Use the publishable (anon) key instead, and rotate the one you used.'
  return null
}

/** Set when the deploy's Supabase settings are wrong; main.jsx shows it instead of a blank page. */
export const configError = checkConfig()

/** Supabase client, or null when no project is configured (the app then runs on sample data). */
export const supabase = !configError && url && key ? createClient(url, key) : null

if (configError) console.error('[MoraPlates] Supabase settings problem:', configError)
else if (!supabase && import.meta.env.DEV) console.info('[MoraPlates] No Supabase keys in .env, using sample data.')

/** Only these addresses may sign in and write. */
export const ALLOWED_EMAIL_DOMAIN = 'uom.lk'
