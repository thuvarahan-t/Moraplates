import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Avatar from './Avatar'
import { CloseIcon } from './icons'
import { Link } from './NavLinks'
import '../styles/comments.css'
import '../styles/people-list-dialog.css'

const PAGE_SIZE = 24

/** Show one public list of profiles, reading more only when requested. */
export default function PeopleListDialog({ title, emptyMessage, loadPage, onClose }) {
  const dialog = useRef(null)
  const heading = useRef(null)
  const backdropPress = useRef(false)
  const headingId = useId()
  const [people, setPeople] = useState([])
  const [afterId, setAfterId] = useState(null)
  const [request, setRequest] = useState({ afterId: null })
  const [failed, setFailed] = useState(false)
  const close = () => dialog.current?.close()

  useEffect(() => {
    if (dialog.current.open) return
    dialog.current.showModal()
    heading.current.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (!request) return
    let active = true
    loadPage(request.afterId, PAGE_SIZE + 1).then(rows => {
      if (!active) return
      const page = rows.slice(0, PAGE_SIZE)
      setPeople(old => [...old, ...page])
      setAfterId(rows.length > PAGE_SIZE ? page.at(-1).id : null)
      setRequest(null)
    }).catch(() => {
      if (!active) return
      setFailed(true)
      setRequest(null)
    })
    return () => { active = false }
  }, [request, loadPage])

  function nextPage() {
    setFailed(false)
    setRequest({ afterId })
  }

  return createPortal(
    <dialog className="cm-dialog people-list-dialog" ref={dialog} onClose={onClose} aria-labelledby={headingId}
      onPointerDown={event => { backdropPress.current = event.target === event.currentTarget }}
      onClick={event => { if (backdropPress.current && event.target === event.currentTarget) close() }}>
      <header className="cm-header">
        <h2 id={headingId} ref={heading} tabIndex={-1}>{title}</h2>
        <button className="cm-close" type="button" aria-label={`Close ${title.toLowerCase()}`} onClick={close}>
          <CloseIcon size={20} />
        </button>
      </header>
      <div className="cm-thread">
        {people.length > 0 && (
          <ul className="people-list" role="list">
            {people.map(person => (
              <li key={person.id}>
                <Link className="person" to={`/u/${person.id}`} onClick={close}>
                  <span aria-hidden="true"><Avatar name={person.name} url={person.avatar} /></span>
                  <span>
                    <b>{person.name}</b>
                    {(person.faculty || person.batch) && <small>{[person.faculty, person.batch].filter(Boolean).join(' · ')}</small>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!people.length && !request && !failed && <p className="cm-status">{emptyMessage}</p>}
        {request && <p className="cm-status" role="status">Loading people…</p>}
        {failed && <p className="cm-status" role="alert">Couldn't load people.</p>}
        {(afterId || failed) && (
          <div className="people-list-actions">
            <button className="btn sm ghost" type="button" disabled={!!request} onClick={nextPage}>
              {failed ? 'Retry' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </dialog>,
    document.body,
  )
}
