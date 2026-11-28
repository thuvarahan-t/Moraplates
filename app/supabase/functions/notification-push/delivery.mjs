export function isPushEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return false
  let url
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.href !== endpoint || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) return false

  const { hostname, pathname } = url
  if (hostname === 'fcm.googleapis.com') return /^\/fcm\/send\/[^/]+$/.test(pathname)
  if (hostname === 'updates.push.services.mozilla.com') return /^\/wpush\/v\d+\/[^/]+$/.test(pathname)
  return (hostname.endsWith('.push.apple.com') || hostname.endsWith('.notify.windows.com'))
    && (pathname !== '/' || !!url.search)
}

export function buildPushPayload(job) {
  const { kind, notification_id: id, actor_id: actor, post_id: post, comment_id: comment } = job
  if (kind === 'follow') return { kind, id, path: `/u/${actor}` }
  if (kind === 'like') return { kind, id, path: `/posts/${post}` }
  if (kind === 'reply') return { kind, id, path: `/posts/${post}?comment=${comment}` }
  return null
}

export function deliveryOutcome(status) {
  if (status === 404 || status === 410) return 'expired'
  if (status === 408 || status === 429 || status >= 500) return 'retry'
  return 'done'
}

export async function verifyDispatch(headers, signingKey, now = Date.now()) {
  const timestamp = headers.get('x-moraplates-push-timestamp')
  const signature = headers.get('x-moraplates-push-signature')
  if (!signingKey || !timestamp || !/^\d{10,12}$/.test(timestamp) || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false
  if (Math.abs(now - Number(timestamp) * 1000) > 120000) return false
  const bytes = Uint8Array.from(signature.match(/../g), pair => Number.parseInt(pair, 16))
  const message = new TextEncoder().encode(`moraplates-notification-push-v1:${timestamp}`)
  return crypto.subtle.verify('HMAC', await signingKey, bytes, message)
}
