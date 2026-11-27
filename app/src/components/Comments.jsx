import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { Link } from './NavLinks'
import Avatar from './Avatar'
import { useFx } from '../lib/fx'
import { usePost } from '../lib/post'
import { useSignInGate } from '../lib/useSignInGate'
import { addComment, deleteComment, fetchComments, friendly, POST_READS } from '../data/queries'
import { timeAgo } from '../lib/format'
import '../styles/social-features.css'

function threadOrder(list) {
  const byId = new Map(list.map(comment => [comment.id, comment]))
  const groups = new Map()
  for (const comment of list) {
    const parent = byId.get(comment.parentId) ?? null
    const key = parent?.id ?? null
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ comment, parent })
  }

  const ordered = []
  const stack = [...(groups.get(null) ?? [])].reverse()
  while (stack.length) {
    const item = stack.pop()
    ordered.push(item)
    const children = groups.get(item.comment.id) ?? []
    for (let index = children.length - 1; index >= 0; index--) stack.push(children[index])
  }
  return ordered
}

/** Load a thread when opened. Report the count change after each successful write. */
export default function Comments(props) {
  return <CommentThread key={props.postId} {...props} />
}

function CommentThread({ postId, onCount }) {
  const { session } = useAuth()
  const { toast } = useFx()
  const { cache } = usePost()
  const gate = useSignInGate()
  const input = useRef(null)
  const [thread, setThread] = useState(null)
  const [retry, setRetry] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let current = true
    fetchComments(postId).then(result => {
      if (current) setThread(result)
    }).catch(error => {
      if (!current) return
      console.error(error)
      setLoadError(true)
    })
    return () => { current = false }
  }, [postId, retry])

  const reply = comment => {
    if (!gate('to reply')) return
    setReplyTo(comment)
    input.current?.focus()
  }

  const send = async event => {
    event.preventDefault()
    const body = text.trim()
    if (busy || !thread || !body || !gate(replyTo ? 'to reply' : 'to comment')) return
    setBusy(true)
    try {
      const comment = await addComment(postId, body, replyTo?.id)
      setThread(previous => ({ ...previous, list: [...previous.list, comment] }))
      cache.invalidate(...POST_READS)
      setText('')
      setReplyTo(null)
      onCount?.(1)
    } catch (error) {
      toast(friendly(error))
    } finally {
      setBusy(false)
    }
  }

  const remove = async id => {
    if (busy) return
    setBusy(true)
    try {
      await deleteComment(id)
      cache.invalidate(...POST_READS)
      setThread(previous => ({
        ...previous,
        list: previous.list.filter(comment => comment.id !== id)
          .map(comment => comment.parentId === id ? { ...comment, parentId: null } : comment),
      }))
      if (replyTo?.id === id) setReplyTo(null)
      onCount?.(-1)
    } catch (error) {
      toast(friendly(error))
    } finally {
      setBusy(false)
    }
  }

  if (loadError) {
    return (
      <div className="cmts">
        <p className="cm-empty">Couldn’t load comments.</p>
        <button className="btn ghost sm" type="button" onClick={() => { setLoadError(false); setRetry(attempt => attempt + 1) }}>Retry</button>
      </div>
    )
  }
  if (!thread) return <div className="cmts"><small className="cm-empty">Loading comments…</small></div>

  return (
    <div className="cmts">
      {thread.list.length === 0 && <small className="cm-empty">No comments yet. Say something.</small>}
      {threadOrder(thread.list).map(({ comment, parent }) => (
        <div className={parent ? 'cm cm-reply' : 'cm'} key={comment.id}>
          <Link to={`/u/${comment.userId}`} aria-label={`${comment.author}'s profile`}><Avatar name={comment.author} url={comment.avatar} /></Link>
          <div>
            <Link className="cm-name" to={`/u/${comment.userId}`}>{comment.author}</Link><small>{timeAgo(comment.createdAt)}</small>
            {parent && <small className="cm-reply-target">Reply to {parent.author}</small>}
            <p>{comment.body}</p>
            <div className="cm-actions">
              {thread.repliesEnabled && <button className="cm-action" type="button" disabled={busy} onClick={() => reply(comment)}>Reply</button>}
              {comment.userId === session?.user?.id && <button className="cm-action cm-del" type="button" disabled={busy} onClick={() => remove(comment.id)}>Delete</button>}
            </div>
          </div>
        </div>
      ))}
      {replyTo && (
        <div className="cm-replying">
          <span>Replying to <b>{replyTo.author}</b></span>
          <button className="cm-action" type="button" disabled={busy} onClick={() => { setReplyTo(null); input.current?.focus() }}>Cancel</button>
        </div>
      )}
      <form className="cbox" onSubmit={send}>
        <input ref={input} maxLength={300} placeholder={replyTo ? 'Write a reply…' : session ? 'Add a comment…' : 'Sign in to comment'} value={text}
          onChange={e => setText(e.target.value)} onFocus={() => !session && gate('to comment')} aria-label={replyTo ? 'Add a reply' : 'Add a comment'} />
        <button className="btn sm" disabled={busy || !text.trim()}>{replyTo ? 'Reply' : 'Send'}</button>
      </form>
    </div>
  )
}
