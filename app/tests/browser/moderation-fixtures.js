import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { createServer } from 'vite'

export const supabaseUrl = 'https://moderation-test.invalid'
export const moderatorId = 'caaa9dea-e70b-4ed9-90b4-caa3da753714'

export async function startModerationTestServer() {
  const server = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    configFile: false,
    envFile: false,
    cacheDir: 'node_modules/.vite-moderation-test',
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('test-anon-key'),
    },
    server: { host: '127.0.0.1', hmr: false },
  })
  return server.listen()
}

export async function useTestSession(page, userId) {
  if (!userId) return
  await page.addInitScript(id => {
    localStorage.setItem('sb-moderation-test-auth-token', JSON.stringify({
      access_token: id, refresh_token: 'test-refresh-token', expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id, email: 'student@uom.lk', user_metadata: {} },
    }))
  }, userId)
}
