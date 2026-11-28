import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useAuth, useModeration } from '../lib/auth'
import { usePost } from '../lib/post'
import { supabase } from '../lib/supabase'
import { useSignInGate } from '../lib/useSignInGate'
import { addComment, deleteComment, fetchComments, friendly, POST_READS } from '../data/queries'
import { moderateContent } from '../data/admin'
import { timeAgo } from '../lib/format'
import { Link } from './NavLinks'
import Avatar from './Avatar'
import { CloseIcon } from './icons'
import '../styles/comments.css'

function groupComments(list) {
  const byId = new Map(list.map(comment => [comment.id, comment]))
  const roots = new Map()
  const rootOf = comment => {
    const path = new Set()
    let root = comment
    while (byId.has(root.parentId) && !roots.has(root.id) && !path.has(root.id)) {
      path.add(root.id)
      root = byId.get(root.parentId)
    }
    const rootId = roots.get(root.id) ?? root.id
    for (const id of path) roots.set(id, rootId)
    return rootId
  }
  const threads = new Map()
  for (const comment of list) {
    const rootId = rootOf(comment)
    if (!threads.has(rootId)) threads.set(rootId, { root: byId.get(rootId), replies: [] })
    if (comment.id !== rootId) threads.get(rootId).replies.push({ comment, parent: byId.get(comment.parentId) })
  }
  return [...threads.values()]
}

export default function Comments({ postId, onClose, onCount }) {
  const dialog = useRef(null)
  const backdropPress = useRef(false)
  const title = useId()
  const close = () => dialog.current?.close()

  useEffect(() => {
    const sheet = dialog.current
    if (!sheet.open) sheet.showModal()

    const viewport = window.visualViewport
    if (!viewport) return
    const positionSheet = () => {
      sheet.style.setProperty('--cm-viewport-height', `${viewport.height}px`)
      sheet.style.setProperty('--cm-viewport-bottom', `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`)
    }
    positionSheet()
    viewport.addEventListener('resize', positionSheet)
    viewport.addEventListener('scroll', positionSheet)
    return () => {
      viewport.removeEventListener('resize', positionSheet)
      viewport.removeEventListener('scroll', positionSheet)
    }
  }, [])

  return (
    <dialog className="cm-dialog" ref={dialog} onClose={onClose} aria-labelledby={title}
      onPointerDown={event => { backdropPress.current = event.target === event.currentTarget }}
      onClick={event => { if (backdropPress.current && event.target === event.currentTarget) close() }}>
      <header className="cm-header">
        <h2 id={title}>Comments</h2>
        <button className="cm-close" type="button" aria-label="Close comments" onClick={close}><CloseIcon size={20} /></button>
      </header>
      {supabase ? <CommentThread postId={postId} onCount={onCount} close={close} />
        : <p className="cm-status">Comments are available when a live project is connected.</p>}
    </dialog>
  )
}

function CommentRow({ comment, parent, onReply, onDelete, close, busy, activeRef }) {
  const path = `/u/${comment.userId}`
  return (
    <div className="cm-row" ref={activeRef}>
      <Link className="cm-avatar" to={path} aria-label={`${comment.author}'s profile`} onClick={close}>
        <Avatar name={comment.author} url={comment.avatar} />
      </Link>
      <div className="cm-content">
        <p>
          <Link className="cm-name" to={path} onClick={close}>{comment.author}</Link>{' '}
          {parent && <><Link className="cm-target" to={`/u/${parent.userId}`} onClick={close}>@{parent.author}</Link>{' '}</>}
          {comment.body}
        </p>
        <div className="cm-meta">
          <small>{timeAgo(comment.createdAt)}</small>
          {onReply && <button className="cm-text-button" type="button" disabled={busy} onClick={onReply}>Reply</button>}
          {onDelete && <button className="cm-text-button" type="button" disabled={busy} onClick={onDelete}>Delete</button>}
        </div>
      </div>
    </div>
  )
}

function CommentThread({ postId, onCount, close }) {
  const { ready, session, profile } = useAuth()
  const { allowed } = useModeration()
  const { cache } = usePost()
  const gate = useSignInGate()
  const input = useRef(null)
  const activeRow = useRef(null)
  const replyListId = useId()
  const [thread, setThread] = useState(null)
  const [retry, setRetry] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [expanded, setExpanded] = useState({})
  const [postedId, setPostedId] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const groups = useMemo(() => groupComments(thread?.list ?? []), [thread])
  const activeCommentId = replyTo?.comment.id ?? postedId

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

  useEffect(() => {
    activeRow.current?.scrollIntoView({ block: 'nearest' })
  }, [replyTo, postedId])

  const canWrite = reason => {
    if (gate(reason)) return true
    if (ready && !session) close()
    return false
  }
  const cancelReply = () => {
    setReplyTo(null)
    setWriteError('')
    input.current?.focus()
  }

  const send = async event => {
    event.preventDefault()
    const body = text.trim()
    if (busy || !thread || !body || !canWrite(replyTo ? 'to reply' : 'to comment')) return
    setBusy(true)
    setWriteError('')
    try {
      const comment = await addComment(postId, body, replyTo?.comment.id)
      setThread(previous => ({ ...previous, list: [...previous.list, comment] }))
      if (replyTo) setExpanded(previous => ({ ...previous, [replyTo.rootId]: true }))
      setPostedId(comment.id)
      cache.invalidate(...POST_READS)
      setText('')
      setReplyTo(null)
      onCount?.(1)
    } catch (error) {
      setWriteError(friendly(error))
    } finally {
      setBusy(false)
    }
  }

  const remove = async ({ id, userId }) => {
    const own = userId === session?.user?.id
    if (busy || (!own && !allowed)) return
    if (!own && !window.confirm('Delete this comment? This cannot be undone.')) return
    setBusy(true)
    setWriteError('')
    try {
      if (own) await deleteComment(id)
      else await moderateContent('comments', id)
      cache.invalidate(...POST_READS)
      setThread(previous => ({
        ...previous,
        list: previous.list.filter(comment => comment.id !== id)
          .map(comment => comment.parentId === id ? { ...comment, parentId: null } : comment),
      }))
      if (replyTo?.comment.id === id || replyTo?.rootId === id) setReplyTo(null)
      onCount?.(-1)
    } catch (error) {
      setWriteError(friendly(error))
    } finally {
      setBusy(false)
    }
  }

  const renderComment = (comment, rootId, parent) => (
    <CommentRow comment={comment} parent={parent} close={close} busy={busy}
      activeRef={activeCommentId === comment.id ? activeRow : undefined}
      onReply={thread.repliesEnabled ? () => {
        if (!canWrite('to reply')) return
        setPostedId(null)
        setReplyTo({ comment, rootId })
        setWriteError('')
        input.current?.focus()
      } : undefined}
      onDelete={allowed || comment.userId === session?.user?.id ? () => remove(comment) : undefined} />
  )

  return (
    <>
      <div className="cm-thread">
        {loadError ? (
          <div className="cm-status">
            <p role="alert">Couldn’t load comments.</p>
            <button className="cm-text-button" type="button" onClick={() => {
              setLoadError(false)
              setRetry(attempt => attempt + 1)
            }}>Retry</button>
          </div>
        ) : !thread ? <p className="cm-status" role="status">Loading comments…</p>
          : !groups.length ? <p className="cm-status">No comments yet.</p>
            : <ol className="cm-list" role="list">
              {groups.map(({ root, replies }) => {
                const listId = `${replyListId}-${root.id}`
                const isExpanded = !!expanded[root.id]
                return (
                  <li key={root.id}>
                    {renderComment(root, root.id)}
                    {replies.length > 0 && (
                      <div className="cm-replies">
                        <button className="cm-text-button cm-expand" type="button" aria-expanded={isExpanded} aria-controls={listId}
                          onClick={() => setExpanded(previous => ({ ...previous, [root.id]: !previous[root.id] }))}>
                          {isExpanded ? 'Hide replies' : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                        </button>
                        <ol className="cm-list cm-reply-list" id={listId} role="list" hidden={!isExpanded}>
                          {isExpanded && replies.map(({ comment, parent }) => (
                            <li key={comment.id}>{renderComment(comment, root.id, parent.id === root.id ? null : parent)}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>}
      </div>
      <footer className="cm-footer">
        {replyTo && (
          <div className="cm-replying">
            <span>Replying to <b>{replyTo.comment.author}</b></span>
            <button className="cm-close" type="button" disabled={busy} aria-label="Cancel reply" onClick={cancelReply}><CloseIcon size={16} /></button>
          </div>
        )}
        {writeError && <p className="cm-write-error" role="alert">{writeError}</p>}
        {session ? (
          <form className="cm-composer" onSubmit={send}>
            {profile && <Avatar name={profile.fullName} url={profile.avatar} />}
            <input ref={input} maxLength={300} placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'} value={text}
              readOnly={busy} onChange={event => setText(event.target.value)} aria-label={replyTo ? 'Add a reply' : 'Add a comment'} />
            <button className="cm-send" type="submit" disabled={busy || !thread || !text.trim()}>{busy ? 'Saving…' : 'Post'}</button>
          </form>
        ) : (
          <button className="cm-send cm-sign-in" type="button" disabled={!ready} onClick={() => canWrite('to comment')}>Sign in to comment</button>
        )}
      </footer>
    </>
  )
}
