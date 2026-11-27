import { loadAssistantCatalog } from './assistant-catalog.js'
import { askAssistantModel, greetAssistant } from './assistant-model.js'
import { stripContactDetails } from './assistant-context.js'

const MAX_QUESTION_LENGTH = 400
const MAX_HISTORY_ANSWER_LENGTH = 1200
const MAX_HISTORY_EXCHANGES = 8
const MAX_BODY_BYTES = 48 * 1024
const WINDOW_MS = 60_000
const REQUESTS_PER_WINDOW = 6

function send(response, status, body) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  if (status === 429) response.setHeader('Retry-After', '60')
  response.end(JSON.stringify(body))
}

async function readChatRequest(request) {
  if (Number(request.headers['content-length']) > MAX_BODY_BYTES) return null
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') return null
  let body = request.body
  if (body === undefined) {
    const chunks = []
    let size = 0
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      size += chunk.length
      if (size > MAX_BODY_BYTES) return null
      chunks.push(chunk)
    }
    body = Buffer.concat(chunks).toString('utf8')
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8')
  if (typeof body === 'string') body = JSON.parse(body)
  return body
}

async function readStudent(url, anonKey, authorization, fetchImpl) {
  if (!/^Bearer [\w.-]{1,4096}$/i.test(authorization ?? '')) return null
  const result = await fetchImpl(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
    signal: AbortSignal.timeout(3500),
  })
  if ([400, 401, 403].includes(result.status)) return null
  if (!result.ok) throw new Error('Student session lookup failed')
  const user = await result.json()
  return typeof user.id === 'string' && /^[^@\s]+@uom\.lk$/i.test(user.email ?? '') ? user.id : null
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return []
  return history.slice(-MAX_HISTORY_EXCHANGES).flatMap(turn => {
    const question = typeof turn?.question === 'string' ? turn.question.trim() : ''
    const answer = typeof turn?.answer === 'string' ? turn.answer.trim() : ''
    if (!question || question.length > MAX_QUESTION_LENGTH || !answer || answer.length > MAX_HISTORY_ANSWER_LENGTH) return []
    return [{ question: stripContactDetails(question), answer: stripContactDetails(answer) }]
  })
}

export function createAssistantHandler(env, { fetchImpl = fetch } = {}) {
  const apiKey = env.GEMINI_API_KEY?.trim()
  const url = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '')
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  const limits = new Map()

  // Limit repeat requests within each running server. Gemini enforces the project quota.
  function reserveRequest(userId) {
    const now = Date.now()
    for (const [id, entry] of limits) if (entry.until <= now) limits.delete(id)
    const entry = limits.get(userId) ?? { count: 0, until: now + WINDOW_MS }
    if (entry.count >= REQUESTS_PER_WINDOW) return false
    entry.count += 1
    limits.set(userId, entry)
    return true
  }

  return async (request, response) => {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST')
      return send(response, 405, { error: 'Use POST for questions.', code: 'invalid_question' })
    }
    if (!apiKey || !url || !anonKey) {
      return send(response, 503, { error: 'Helena is waiting for setup.', code: 'not_configured' })
    }
    const chat = await readChatRequest(request).catch(() => null)
    const question = typeof chat?.question === 'string' ? chat.question.trim() : ''
    if (!question || question.length > MAX_QUESTION_LENGTH) {
      return send(response, 400, { error: 'Enter a question up to 400 characters.', code: 'invalid_question' })
    }

    try {
      const userId = await readStudent(url, anonKey, request.headers.authorization, fetchImpl)
      if (!userId) {
        return send(response, 401, { error: 'Sign in with your university email to ask.', code: 'unauthorized' })
      }
      const greeting = greetAssistant(question, chat.context)
      if (greeting) return send(response, 200, greeting)
      if (!reserveRequest(userId)) {
        return send(response, 429, { error: 'The kitchen is busy. Try again in a minute.', code: 'rate_limited' })
      }
      const catalog = await loadAssistantCatalog({ url, anonKey, fetchImpl })
      const answer = await askAssistantModel({
        apiKey, question: stripContactDetails(question), history: cleanHistory(chat.history), context: chat.context, catalog, fetchImpl,
      })
      return send(response, 200, answer)
    } catch (error) {
      if (error?.status === 429) {
        return send(response, 429, { error: 'The kitchen is busy. Try again in a minute.', code: 'rate_limited' })
      }
      return send(response, 503, { error: 'Helena is temporarily unavailable.', code: 'unavailable' })
    }
  }
}
