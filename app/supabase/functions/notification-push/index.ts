import webPush from 'npm:web-push@3.6.7'
import { buildPushPayload, deliveryOutcome, isPushEndpoint, verifyDispatch } from './delivery.mjs'

const dispatchKey = Deno.env.get('MORAPLATES_PUSH_DISPATCH_SECRET')
const publicKey = Deno.env.get('MORAPLATES_VAPID_PUBLIC_KEY')
const privateKey = Deno.env.get('MORAPLATES_VAPID_PRIVATE_KEY')
const subject = Deno.env.get('MORAPLATES_VAPID_SUBJECT') || 'https://moraplates.vercel.app'
const projectUrl = Deno.env.get('SUPABASE_URL')
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const encoder = new TextEncoder()
const signingKey = dispatchKey
  ? crypto.subtle.importKey('raw', encoder.encode(dispatchKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  : null

type Delivery = {
  attempt: number
  job_id: string
  notification_id: string
  kind: string
  actor_id: string
  post_id: string | null
  comment_id: string | null
  endpoint: string | null
  p256dh: string
  auth_secret: string
}

async function rpc(name: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`${projectUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(7000),
  })
  if (!response.ok) throw new Error(`Push database request failed (${response.status})`)
  return response
}

async function deliver(job: Delivery) {
  const payload = buildPushPayload(job)
  if (!payload || !job.endpoint || !isPushEndpoint(job.endpoint)) return 'done'

  let request
  try {
    request = webPush.generateRequestDetails(
      { endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth_secret } },
      JSON.stringify(payload),
      { vapidDetails: { subject, publicKey: publicKey!, privateKey: privateKey! }, TTL: 300, urgency: 'normal' },
    )
  } catch {
    console.warn('Could not encrypt a push notification')
    return 'done'
  }

  try {
    const response = await fetch(request.endpoint, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'error',
      signal: AbortSignal.timeout(7000),
    })
    await response.body?.cancel()
    if (!response.ok && response.status !== 404 && response.status !== 410) {
      console.warn('Push service rejected delivery', response.status)
    }
    return deliveryOutcome(response.status)
  } catch {
    return 'retry'
  }
}

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  if (!await verifyDispatch(request.headers, signingKey)) return new Response(null, { status: 401 })
  if (!publicKey || !privateKey || !projectUrl || !serviceKey) return new Response(null, { status: 503 })

  try {
    const claimed = await rpc('claim_web_push_deliveries')
    const jobs: Delivery[] = await claimed.json()
    const results = await Promise.allSettled(jobs.map(async job => {
      const outcome = await deliver(job)
      if (outcome !== 'retry') {
        const response = await rpc('finish_web_push_delivery', {
          push_job_id: job.job_id,
          push_attempt: job.attempt,
          expired: outcome === 'expired',
        })
        await response.body?.cancel()
      }
    }))
    if (results.some(result => result.status === 'rejected')) console.warn('Some push deliveries will be retried')
    return new Response(null, { status: 204 })
  } catch {
    return new Response(null, { status: 503 })
  }
})
