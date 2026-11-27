import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { Link } from './NavLinks'
import Avatar from './Avatar'
import { useFx } from '../lib/fx'
import { usePost } from '../lib/post'
import { useSignInGate } from '../lib/useSignInGate'
import { addComment, deleteComment, fetchComments, friendly, POST_READS } from '../data/queries'
import { timeAgo } from '../lib/format'

/** Comment thread under a post. Loads when opened. `onCount` reports +1 / -1 changes. */
export default function Comments({ postId, onCount }) {
  const { session } = useAuth()
  const { toast } = useFx()
  const { cache } = usePost()
  const gate = useSignInGate()
  const [list, setList] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => fetchComments(postId).then(setList).catch(e => { console.error(e); setList([]); toast("Couldn't load comments.") })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [postId])

  const send = async e => {
    e.preventDefault()
    const body = text.trim()
    if (!body || !gate('to comment')) return
    setBusy(true)
    try {
      await addComment(postId, body)
      cache.invalidate(...POST_READS)
      setText('')
      onCount(1)
      await load()
    } catch (err) {
      toast(friendly(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async id => {
    try {
      await deleteComment(id)
      cache.invalidate(...POST_READS)
      onCount(-1)
      setList(l => l.filter(c => c.id !== id))
    } catch (err) {
      toast(friendly(err))
    }
  }

  return (
    <div className="cmts">
      {list === null && <small className="cm-empty">Loading…</small>}
      {list?.length === 0 && <small className="cm-empty">No comments yet. Say something.</small>}
      {list?.map(c => (
        <div className="cm" key={c.id}>
          <Link to={`/u/${c.userId}`} aria-label={`${c.author}'s profile`}><Avatar name={c.author} url={c.avatar} /></Link>
          <div>
            <Link className="cm-name" to={`/u/${c.userId}`}>{c.author}</Link><small>{timeAgo(c.createdAt)}</small>
            <p>{c.body}</p>
            {c.userId === session?.user?.id && <button className="cm-del" onClick={() => remove(c.id)}>Delete</button>}
          </div>
        </div>
      ))}
      <form className="cbox" onSubmit={send}>
        <input maxLength={300} placeholder={session ? 'Add a comment…' : 'Sign in to comment'} value={text}
          onChange={e => setText(e.target.value)} onFocus={() => !session && gate('to comment')} aria-label="Add a comment" />
        <button className="btn sm" disabled={busy || !text.trim()}>Send</button>
      </form>
    </div>
  )
}
