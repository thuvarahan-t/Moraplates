import { Clock } from 'lucide-react'

const closureTime = new Intl.DateTimeFormat('en-LK', { timeZone: 'Asia/Colombo', hour: 'numeric', minute: '2-digit', hour12: true })

export default function CanteenClosure({ canteen, reported, reportedOpen, busy, onAction }) {
  const status = reported ? 'closed' : reportedOpen ? 'open' : null
  const expiresAt = reported ? canteen.closedUntil : canteen.openUntil
  const heading = reported ? 'Closed now' : reportedOpen ? 'Community report: open' : 'Is the canteen closed now?'

  return (
    <div className="closure-box">
      <Clock size={19} aria-hidden="true" />
      <div className="closure-copy" role="status">
        <b>{heading}</b>
        <small>{status
          ? `Reported ${status} until ${closureTime.format(Date.parse(expiresAt))} (Colombo time).`
          : 'Report a temporary closure for 60 minutes.'}</small>
      </div>
      <button type="button" className="mini" disabled={busy} onClick={() => onAction(reported ? 'open' : 'closed')}>
        {reported ? 'No, it’s open' : 'Report closed'}
      </button>
    </div>
  )
}
