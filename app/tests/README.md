# Verification
From app:
- npm ci
- npm test
- npm run build
- npm install --no-save --package-lock=false @playwright/test@1.51.1
- npx playwright install chromium
- npx playwright test

Browser tests use the demo data (leave VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY unset). They exercise mobile routes, seen history, sharing, profile search and the image crop UI. They do not prove a real Storage upload or server authorization.

For an isolated local Supabase project, run `supabase init` if needed, `supabase start`, then `supabase db reset`. Load the local environment using `set -a; source <(supabase status -o env); set +a` and run `node tests/integration/supabase.mjs`. The integration script refuses non-local URLs and creates disposable test accounts. Never run it against production.
