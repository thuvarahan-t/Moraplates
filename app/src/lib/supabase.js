import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Supabase client, or null when no project is configured (the app then runs on sample data). */
export const supabase = url && key ? createClient(url, key) : null

if (!supabase && import.meta.env.DEV) {
  console.info('[MoraPlates] No Supabase keys in .env.local, using the sample data from index.html.')
}

/** Only these addresses may sign in and write. Open question in the design overview. */
export const ALLOWED_EMAIL_DOMAIN = 'uom.lk'
