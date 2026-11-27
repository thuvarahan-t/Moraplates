import { useEffect, useId, useRef } from 'react'
import { Clock } from 'lucide-react'
import { CloseIcon } from './icons'

const closureTime = new Intl.DateTimeFormat('en-LK', { timeZone: 'Asia/Colombo', hour: 'numeric', minute: '2-digit', hour12: true })

function ReportOptions({ busy, onReport }) {
  return <>
    <button type="button" className="mini" disabled={busy} onClick={() => onReport('hour')}>Report closed</button>
    <button type="button" className="mini" disabled={busy} onClick={() => onReport('today')}>Report closed today</button>
  </>
}

export default function CanteenClosure({ canteen, reported, busy, onAction }) {
  const dialog = useRef(null)
  const trigger = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const mobile = matchMedia('(max-width: 760px)')
    const closeOnMobile = event => { if (event.matches) dialog.current?.close() }
    mobile.addEventListener('change', closeOnMobile)
    return () => mobile.removeEventListener('change', closeOnMobile)
  }, [])

  const reportFromDialog = action => {
    dialog.current.close()
    onAction(action)
  }

  return <>
    <div className="closure-box">
      <Clock size={19} aria-hidden="true" />
      <div className="closure-copy">
        <b>{reported ? 'Community report: closed' : 'Is the canteen closed now?'}</b>
        <small>{reported
          ? `Reported closed until ${closureTime.format(Date.parse(canteen.closedUntil))} (Colombo time).`
          : 'Report a closure for 60 minutes or until midnight (Colombo time).'}</small>
      </div>
      <div className="closure-actions">
        <button type="button" className="mini closure-dialog-trigger" ref={trigger} aria-haspopup="dialog"
          disabled={busy} onClick={() => dialog.current.showModal()}>Report closed</button>
        <span className="closure-inline-options"><ReportOptions busy={busy} onReport={onAction} /></span>
        {reported && <button type="button" className="mini" disabled={busy} onClick={() => onAction('withdraw')}>Undo my report</button>}
      </div>
    </div>

    <dialog className="closure-dialog" ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
      onClose={() => trigger.current?.focus()}
      onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close() }}>
      <div className="closure-dialog-panel">
        <div className="closure-dialog-header">
          <h2 id={titleId}>Report closed</h2>
          <button type="button" className="social-icon" aria-label="Close" onClick={() => dialog.current.close()}>
            <CloseIcon />
          </button>
        </div>
        <div className="closure-dialog-description" id={descriptionId}>
          Report {canteen.name} closed for 60 minutes or until midnight (Colombo time).
        </div>
        <div className="closure-actions"><ReportOptions busy={busy} onReport={reportFromDialog} /></div>
      </div>
    </dialog>
  </>
}
