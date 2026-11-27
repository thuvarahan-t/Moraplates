import { useEffect, useId, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { CloseIcon } from './icons'
import HelenaAvatar from './HelenaAvatar'
import { Link } from './NavLinks'
import '../styles/ask-moraplates.css'

const MAX_QUESTION_LENGTH = 400
const CONTEXT_STATUSES = new Set(['answer', 'clarify', 'no_data', 'language', 'correction'])
const LANGUAGE_TAGS = { en: 'en', ta: 'ta', si: 'si', tanglish: 'ta-Latn', singlish: 'si-Latn' }
const SUGGESTIONS = [
  { language: 'en', text: 'Which canteens are open now?' },
  { language: 'ta', text: 'ரூ. 300க்குள் என்ன சாப்பாடு கிடைக்கும்?' },
  { language: 'si', text: 'හොඳම කොත්තු තියෙන්නේ කොහෙද?' },
]

const ERROR_MESSAGES = {
  not_configured: 'Helena is still setting up her kitchen. Try again later.',
  rate_limited: 'The kitchen is busy. Give Helena a moment and try again.',
  unauthorized: 'Your session expired. Sign in again to chat.',
  invalid_question: `Enter a question of ${MAX_QUESTION_LENGTH} characters or fewer.`,
  unavailable: 'Helena is taking a break. Try again in a moment.',
}

function textLanguage(text) {
  if (/\p{Script=Tamil}/u.test(text)) return 'ta'
  if (/\p{Script=Sinhala}/u.test(text)) return 'si'
}

function languageCode(language) {
  return typeof language === 'string' && Object.hasOwn(LANGUAGE_TAGS, language) ? language : null
}

function preferenceKey(studentId) {
  return `moraplates:helena:language:${studentId}`
}

function readPreference(studentId) {
  if (!studentId) return null
  try { return languageCode(sessionStorage.getItem(preferenceKey(studentId))) }
  catch { return null }
}

function savePreference(studentId, language) {
  if (!studentId) return
  try {
    if (language) sessionStorage.setItem(preferenceKey(studentId), language)
    else sessionStorage.removeItem(preferenceKey(studentId))
  } catch {
    // The current chat still keeps the preference when browser storage is unavailable.
  }
}

export default function HelenaChat({ accessToken, firstName, studentId, ready, visible }) {
  const fieldId = useId()
  const panelId = useId()
  const titleId = useId()
  const field = useRef(null)
  const launcher = useRef(null)
  const panel = useRef(null)
  const stream = useRef(null)
  const nextId = useRef(0)
  const activeRequest = useRef(null)
  const keepAtBottom = useRef(true)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [exchanges, setExchanges] = useState([])
  const [context, setContext] = useState(() => ({
    languagePreference: readPreference(studentId), lastLanguage: null, focus: null,
  }))
  const pending = exchanges.at(-1)?.pending ?? false

  useEffect(() => () => {
    activeRequest.current?.abort()
    activeRequest.current = null
  }, [])

  useEffect(() => {
    if (!open) return
    const dialog = panel.current
    const viewport = window.visualViewport
    if (!viewport) return
    const updateBounds = () => {
      dialog.style.setProperty('--helena-layout-height', `${window.innerHeight}px`)
      dialog.style.setProperty('--helena-viewport-top', `${Math.max(0, viewport.offsetTop)}px`)
      const keyboardOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      dialog.style.setProperty('--helena-keyboard', `${keyboardOffset}px`)
    }
    updateBounds()
    viewport.addEventListener('resize', updateBounds)
    viewport.addEventListener('scroll', updateBounds)
    return () => {
      viewport.removeEventListener('resize', updateBounds)
      viewport.removeEventListener('scroll', updateBounds)
    }
  }, [open])

  useEffect(() => {
    if (!visible && panel.current.open) panel.current.close()
  }, [visible])

  useEffect(() => {
    if (open && keepAtBottom.current && stream.current) stream.current.scrollTop = stream.current.scrollHeight
  }, [exchanges, open])

  function openChat() {
    keepAtBottom.current = true
    panel.current.showModal()
    setOpen(true)
  }

  function closeChat() {
    panel.current.close()
  }

  function handleClose() {
    setOpen(false)
    if (!launcher.current.hidden) launcher.current.focus({ preventScroll: true })
  }

  function handleBackdrop(event) {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) closeChat()
  }

  async function ask(event) {
    event.preventDefault()
    const question = draft.trim()
    if (!accessToken || !question || question.length > MAX_QUESTION_LENGTH || activeRequest.current) return

    const history = exchanges.filter(exchange => CONTEXT_STATUSES.has(exchange.status)).slice(-8)
      .map(({ question, answer }) => ({ question, answer }))
    const exchangeId = ++nextId.current
    const controller = new AbortController()
    activeRequest.current = controller
    const timer = setTimeout(() => controller.abort(), 30_000)
    keepAtBottom.current = true
    setExchanges(previous => [...previous.slice(-39), { id: exchangeId, question, pending: true }])
    setDraft('')

    const complete = result => setExchanges(previous => previous.map(exchange =>
      exchange.id === exchangeId ? { id: exchangeId, question, ...result } : exchange))

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ question, history, context }),
        signal: controller.signal,
      })
      const payload = await response.json()
      if (activeRequest.current !== controller) return
      if (response.ok && typeof payload?.answer === 'string' && payload.answer.trim()) {
        const language = languageCode(payload.language)
        const nextContext = payload.context
        if (nextContext && typeof nextContext === 'object' && !Array.isArray(nextContext)) {
          const languagePreference = languageCode(nextContext.languagePreference)
          setContext({
            languagePreference,
            lastLanguage: languageCode(nextContext.lastLanguage) ?? language,
            focus: nextContext.focus ?? null,
          })
          if (languagePreference !== context.languagePreference) savePreference(studentId, languagePreference)
        }
        complete({ answer: payload.answer.trim(), status: payload.status, language })
      } else {
        complete({ error: ERROR_MESSAGES[payload?.code] ?? ERROR_MESSAGES.unavailable })
        setDraft(current => current || question)
      }
    } catch {
      if (activeRequest.current === controller) {
        complete({ error: ERROR_MESSAGES.unavailable })
        setDraft(current => current || question)
      }
    } finally {
      clearTimeout(timer)
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }

  return (
    <>
      <button ref={launcher} className="helena-launcher" type="button" hidden={!visible}
        aria-label="Chat with Helena" title="Chat with Helena" aria-haspopup="dialog"
        aria-expanded={open} aria-controls={panelId} onClick={openChat}>
        <HelenaAvatar size={54} />
      </button>
      <dialog ref={panel} className="helena-panel" id={panelId} aria-labelledby={titleId}
        onClose={handleClose} onClick={handleBackdrop}>
        <header className="helena-header">
          <HelenaAvatar size={42} />
          <div>
            <h2 id={titleId}>Helena</h2>
            <p>MoraPlates canteen chat</p>
          </div>
          <button className="helena-close" type="button" aria-label="Close chat" onClick={closeChat}>
            <CloseIcon />
          </button>
        </header>
        <div className="helena-stream" ref={stream} role="log" aria-label="Messages" tabIndex={0}
          onScroll={event => {
            const list = event.currentTarget
            keepAtBottom.current = list.scrollHeight - list.clientHeight - list.scrollTop < 48
          }}>
          <p className="helena-bubble helena-reply">
            <strong>{firstName ? `Hi, ${firstName}!` : 'Hi, I’m Helena!'}</strong>{' '}
            Ask me about canteens, menu prices or ratings.
          </p>
          {!ready && <p className="helena-bubble helena-reply helena-status">Checking your sign-in…</p>}
          {ready && !accessToken && (
            <Link to="/welcome" className="btn sm helena-sign-in" onClick={closeChat}>Sign in to chat</Link>
          )}
          {accessToken && !exchanges.length && (
            <div className="helena-suggestions" role="group" aria-label="Suggested questions">
              {SUGGESTIONS.map(({ language, text }) => (
                <button className="helena-suggestion" key={language} type="button" lang={language}
                  onClick={() => { setDraft(text); field.current?.focus() }}>{text}</button>
              ))}
            </div>
          )}
          {exchanges.map(({ id, question, pending, error, answer, status, language }) => (
            <div className="helena-exchange" key={id}>
              <p className="helena-bubble helena-question" dir="auto" lang={textLanguage(question)}>
                <span className="sr">You asked </span>{question}
              </p>
              {pending && <p className="helena-bubble helena-reply helena-status">Helena is replying…</p>}
              {error && <p className="helena-bubble helena-reply helena-error">{error}</p>}
              {answer && (
                <p className="helena-bubble helena-reply" dir="auto">
                  <span className="sr">Helena replied </span>
                  {firstName && status === 'greeting' && <><strong>{firstName},</strong>{' '}</>}
                  <span lang={LANGUAGE_TAGS[language] ?? textLanguage(answer)}>{answer}</span>
                </p>
              )}
            </div>
          ))}
        </div>
        {accessToken && (
          <form className="helena-form" onSubmit={ask}>
            <label htmlFor={fieldId} className="sr">Message Helena</label>
            <textarea ref={field} id={fieldId} rows={1} maxLength={MAX_QUESTION_LENGTH} dir="auto"
              placeholder="Message Helena…" value={draft} enterKeyHint="send"
              onChange={event => setDraft(event.target.value)} onKeyDown={event => {
                if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
                event.preventDefault()
                event.currentTarget.form.requestSubmit()
              }} required />
            <button className="helena-send" type="submit" aria-label="Send message" disabled={!draft.trim() || pending}>
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
        )}
      </dialog>
    </>
  )
}
