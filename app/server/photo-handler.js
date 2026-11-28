import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const PHOTO_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9_-][a-z0-9_.-]{0,159}\.(?:jpe?g|png|webp)$/i
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const clean = value => (value ?? '').trim().replace(/^["']|["']$/g, '').trim()

export function createPhotoHandler(env, { fetchImpl = fetch } = {}) {
  const url = clean(env.VITE_SUPABASE_URL).replace(/\/+$/, '')
  const key = clean(env.VITE_SUPABASE_ANON_KEY)
  const headers = { apikey: key, Authorization: `Bearer ${key}` }

  return async (request, response) => {
    response.setHeader('Cache-Control', 'private, no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD')
      response.statusCode = 405
      return response.end()
    }
    const paths = new URL(request.url, 'http://localhost').searchParams.getAll('path')
    if (paths.length !== 1 || paths[0] !== paths[0].trim() || !PHOTO_PATH.test(paths[0])) {
      response.statusCode = 400
      return response.end()
    }
    if (!url || !key) {
      response.statusCode = 503
      return response.end()
    }

    const [path] = paths
    const signal = AbortSignal.timeout(8_000)
    try {
      // Check the database before touching Storage, even if Storage's CDN has a cached copy.
      const visibility = await fetchImpl(`${url}/rest/v1/rpc/can_serve_photo`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_path: path }), signal,
      })
      if (!visibility.ok) throw new Error('Photo visibility lookup failed')
      if (await visibility.json() !== true) {
        response.statusCode = 404
        return response.end()
      }

      const objectPath = path.split('/').map(encodeURIComponent).join('/')
      const photo = await fetchImpl(`${url}/storage/v1/object/authenticated/photos/${objectPath}`, {
        method: request.method, headers: { ...headers, 'Cache-Control': 'no-cache' },
        signal, redirect: 'error',
      })
      const type = photo.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
      if (!photo.ok || !IMAGE_TYPES.has(type)) {
        await photo.body?.cancel()
        response.statusCode = photo.status >= 500 ? 502 : 404
        return response.end()
      }

      response.setHeader('Content-Type', type)
      if (request.method === 'HEAD') return response.end()
      await pipeline(Readable.fromWeb(photo.body), response)
    } catch {
      if (response.headersSent || response.destroyed) {
        if (!response.destroyed) response.destroy()
        return
      }
      response.statusCode = 502
      response.end()
    }
  }
}
