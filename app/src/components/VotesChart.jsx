import { Link } from './NavLinks'
import CountUp from './CountUp'
import { CrownIcon } from './icons'
import { plural } from '../lib/format'

const TOP = 5

/** Clean axis steps: 1, 2, 5, 10, 20, 50… so ticks read as round numbers. */
function niceAxis(max) {
  const raw = Math.max(1, max / 4)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw)
  const top = Math.max(step, Math.ceil(Math.max(1, max) / step) * step)
  const ticks = []
  for (let t = 0; t <= top; t += step) ticks.push(t)
  return { top, ticks }
}

// "Goda Uda Staff Canteen" -> "Goda Uda Staff" on the axis (the full name is in the tooltip).
const shortName = n => { const s = n.replace(/\s+canteen$/i, ''); return s.length > 2 ? s : n }

/**
 * Column chart of the five most-voted canteens this week.
 * One series, one colour (no legend; the title names it), value on each cap,
 * hover/focus tooltip, every column links to its canteen, plus a screen-reader table.
 */
export default function VotesChart({ canteens }) {
  const top = [...canteens].sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name)).slice(0, TOP)
  const total = canteens.reduce((n, c) => n + c.votes, 0)
  const { top: axisTop, ticks } = niceAxis(Math.max(...top.map(c => c.votes), 0))
  const share = v => (total ? Math.round((v / total) * 100) : 0)
  const best = Math.max(0, ...top.map(c => c.votes)) // every canteen tied for first gets a crown

  return (
    <div className="card vchart rise">
      <div className="mh"><h3>Votes this week</h3><span>Top {TOP} canteens · {plural(total, 'vote')} in all</span></div>

      <div className="vc-plot">
        <div className="vc-grid" aria-hidden="true">
          {ticks.map(t => (
            <div key={t} className="vc-tick" style={{ bottom: `${(t / axisTop) * 100}%` }}><span>{t}</span></div>
          ))}
        </div>
        <div className="vc-cols">
          {top.map((c, i) => {
            const pct = (c.votes / axisTop) * 100
            const voteSummary = `${plural(c.votes, 'vote')} · ${share(c.votes)}% of all votes`
            return (
              <Link key={c.id} className="vc-col" to={`/canteens/${c.id}`} aria-label={`${c.name}, ${voteSummary}`} style={{ '--i': i, '--h': `${pct}%` }}>
                <span className="vc-bar" />
                {/* outside the bar so the number isn't squished while the bar grows */}
                <span className="vc-cap" aria-hidden="true">
                  {c.votes === best && best > 0 && <CrownIcon className="vc-crown" size={18} />}
                  <CountUp to={c.votes} />
                </span>
                <span className="vc-tip" aria-hidden="true">
                  <b>{c.name}</b>
                  <span>{voteSummary}</span>
                </span>
              </Link>
            )
          })}
        </div>
        {total === 0 && <p className="vc-empty">No votes yet this week. Be the first below!</p>}
      </div>
      <div className="vc-names" aria-hidden="true">
        {top.map(c => <span key={c.id}>{shortName(c.name)}</span>)}
      </div>

      {/* The same numbers in a table for screen readers */}
      <table className="sr">
        <caption>Votes this week, top {TOP} canteens</caption>
        <thead><tr><th>Canteen</th><th>Votes</th><th>Share</th></tr></thead>
        <tbody>
          {top.map(c => <tr key={c.id}><th scope="row">{c.name}</th><td>{c.votes}</td><td>{share(c.votes)}%</td></tr>)}
        </tbody>
      </table>
    </div>
  )
}
