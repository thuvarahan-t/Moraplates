import { useEffect, useId, useRef, useState } from 'react'
import { fetchCanteenPhotos } from '../data/queries'
import { queryKey } from '../data/queryCache'
import { useQuery } from '../data/useQuery'
import { TrashIcon } from './icons'
import Loader from './Loader'

const PAGE_SIZE = 12

export default function CanteenPhotoManager({ canteen, removal, onClose }) {
  const dialog = useRef(null)
  const title = useId()
  const [page, setPage] = useState(0)
  const [notice, setNotice] = useState('')
  const { data, loading, error, reload } = useQuery(queryKey('canteen-manage-photos', canteen.id, page),
    () => fetchCanteenPhotos(canteen.id, PAGE_SIZE + 1, page * PAGE_SIZE))

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal()
  }, [])

  return (
    <dialog ref={dialog} className="canteen-photo-manager" aria-labelledby={title} onClose={onClose}
      onCancel={event => { if (removal.busy) event.preventDefault() }}>
      <div className="formcard">
        <h2 id={title}>Manage canteen photos</h2>
        {notice && <p role="status">{notice}</p>}
        {loading && <Loader label="Loading gallery photos" />}
        {error && <p role="alert">Couldn't load gallery photos. <button type="button" className="mini" onClick={reload}>Retry</button></p>}
        {data?.length === 0 && <p>{page > 0 ? 'No more gallery photos.' : 'No gallery photos yet.'}</p>}
        <ul className="canteen-managed-photos">
          {page === 0 && canteen.photoPath && canteen.photo && (
            <ManagedPhoto url={canteen.photo} caption="Cover photo" label="Delete canteen cover photo"
              disabled={removal.busy} onRemove={() => removal.removeCover(canteen, setNotice)} />
          )}
          {data?.slice(0, PAGE_SIZE).map((photo, index) => (
            <ManagedPhoto key={photo.id} url={photo.url} caption={photo.by}
              primary={photo.id === canteen.primaryPhoto?.id} disabled={removal.busy}
              label={`Delete gallery photo ${page * PAGE_SIZE + index + 1} by ${photo.by}`}
              onRemove={() => removal.removePhoto(photo, { notify: setNotice })} />
          ))}
        </ul>
        <div className="canteen-photo-manager-actions">
          {page > 0 && <button type="button" className="mini" disabled={removal.busy} onClick={() => setPage(p => p - 1)}>Previous photos</button>}
          {data?.length > PAGE_SIZE && <button type="button" className="mini" disabled={removal.busy} onClick={() => setPage(p => p + 1)}>Next photos</button>}
          <button type="button" className="btn sm ghost" disabled={removal.busy} onClick={() => dialog.current.close()}>Done</button>
        </div>
      </div>
    </dialog>
  )
}

function ManagedPhoto({ url, caption, label, primary, disabled, onRemove }) {
  return (
    <li>
      <img src={url} alt="" loading="lazy" />
      <div className="canteen-managed-photo-actions">
        <span>{caption}{primary && <small>Primary photo</small>}</span>
        <button type="button" className="social-icon canteen-delete-action" title={label} aria-label={label}
          disabled={disabled} onClick={onRemove}><TrashIcon size={18} /></button>
      </div>
    </li>
  )
}
