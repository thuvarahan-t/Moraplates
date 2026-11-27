import { Clock } from 'lucide-react'
import { canteenStatusLabel, isReportedClosed, lastReportLabel } from '../lib/food'

export default function CanteenClosure({ canteen, now, busy, onAction }) {
  const closed = isReportedClosed(canteen, now)
  const lastReport = lastReportLabel(canteen)
  const heading = closed || canteen.openUntil || lastReport ? canteenStatusLabel(canteen, now) : 'Is the canteen closed now?'

  return (
    <div className="closure-box">
      <Clock size={19} aria-hidden="true" />
      <div className="closure-copy" role="status">
        <b>{heading}</b>
        {lastReport
          ? <small><time dateTime={canteen.lastReportedAt}>{lastReport}</time></small>
          : <small>{closed ? 'Community closure report.' : 'Help students plan their visit with a closure report.'}</small>}
      </div>
      <button type="button" className="mini" disabled={busy} onClick={() => onAction(closed ? 'open' : 'closed')}>
        {closed ? 'Report opened' : 'Report closed today'}
      </button>
    </div>
  )
}
