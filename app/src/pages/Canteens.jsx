import { useEffect, useMemo, useState } from 'react'
import { Pin, Share2 } from 'lucide-react'
import { shareLink } from '../lib/share'
import { useFx } from '../lib/fx'
import { useNavigate } from 'react-router'
import { Link } from '../components/NavLinks'
import MapView from '../components/MapView'
import CanteenThumb, { firstPhotoByCanteen } from '../components/CanteenThumb'
import Loader from '../components/Loader'
import { LocationIcon, MapIcon, PlusIcon, SearchIcon } from '../components/icons'
import { useHomeData } from '../data/useHomeData'
import { PIN_LIMIT, useCanteenPins } from '../data/useCanteenPins'
import { useQuery } from '../data/useQuery'
import { CANTEEN_GALLERY_KEY, fetchCanteenGallery } from '../data/queries'
import { supabase } from '../lib/supabase'
import { byVotes, canteenStatusLabel, hourLabel, isOpen, lastReportLabel, ratingChip, superPercent } from '../lib/food'
import { tapHaptic } from '../lib/feedback'
import { useSignInGate } from '../lib/useSignInGate'

const SORTS = [['votes', 'Top voted'], ['open', 'Open now'], ['cheap', 'Cheapest']]

/** Canteens ranked by this week's votes, food search, map (renderCanteens() in index.html). */
export default function Canteens() {
  const { data, loading } = useHomeData()
  const { canteens, foods } = data
  const navigate = useNavigate()
  const {toast}=useFx()
  const [now,setNow]=useState(Date.now())
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),30_000);return()=>clearInterval(t)},[])
  const gate = useSignInGate()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('votes')
  const [quiet, setQuiet] = useState(false) // typing re-renders without replaying the rise animation
  const [showMap, setShowMap] = useState(false)
  const { data: photos } = useQuery(CANTEEN_GALLERY_KEY, fetchCanteenGallery, { enabled: !!supabase })
  const thumbs = firstPhotoByCanteen(photos)
  const { pins: pinnedIds, setPin, error: pinError, loading: pinsLoading, reload: reloadPins } = useCanteenPins(canteens)
  const [savingPin, setSavingPin] = useState(false)

  const totalVotes = canteens.reduce((total, canteen) => total + canteen.votes, 0)
  const minPrice = c => Math.min(...foods.filter(f => f.canteenId === c.id).map(f => f.price))
  const nameOf = id => canteens.find(c => c.id === id)?.name ?? ''

  const term = q.trim().toLowerCase()
  const matches = term ? foods.filter(f => f.name.toLowerCase().includes(term)).sort((a, b) => superPercent(b) - superPercent(a)) : []
  let list = sort === 'open' ? canteens.filter(c=>isOpen(c,now)) : [...canteens]
  list.sort(sort === 'cheap' ? (a, b) => (minPrice(a) - minPrice(b)) || 0 : byVotes) // empty menus sort last
  if (term) list = list.filter(c => c.name.toLowerCase().includes(term) || matches.some(f => f.canteenId === c.id))
  const pinOrder = new Map(pinnedIds.map((id, index) => [id, index]))
  list.sort((a, b) => (pinOrder.get(a.id) ?? PIN_LIMIT) - (pinOrder.get(b.id) ?? PIN_LIMIT))

  const mapPoints = useMemo(() => canteens.filter(c => c.lat != null && c.lng != null)
    .map(c => ({ id: c.id, lat: c.lat, lng: c.lng, label: c.name })), [canteens])

  async function togglePin(canteen, pinned) {
    if (savingPin) return
    setSavingPin(true)
    try {
      await setPin(canteen.id, pinned)
      tapHaptic()
      toast(pinned ? `${canteen.name} pinned` : `${canteen.name} unpinned`)
    } catch (error) {
      toast(error.message?.startsWith('You can pin') ? error.message : "Couldn't update your pins. Try again.")
    } finally {
      setSavingPin(false)
    }
  }

  return (
    <section className="view"><div className="band"><div className="wrap">
      <div className="vh">
        <div><h2>Canteens</h2><p>Ranked by student votes this week.</p></div>
        <button className="btn sm" onClick={() => gate('to add a canteen') && navigate('/canteens/new')}><PlusIcon />Add canteen</button>
      </div>

      <div className="ctl">
        <label className="search">
          <SearchIcon size={20} /><span className="sr">Search a food or canteen</span>
          <input type="search" placeholder="Where can I get kottu?" autoComplete="off" value={q} onChange={e => { setQ(e.target.value); setQuiet(true) }} />
        </label>
        <div className="chips scroll">
          {SORTS.map(([id, n]) => (
            <button key={id} className={'chip' + (sort === id ? ' on' : '')} aria-pressed={sort === id} onClick={() => { setSort(id); setQuiet(false) }}>{n}</button>
          ))}
          <button className={'chip' + (showMap ? ' on' : '')} aria-pressed={showMap} onClick={() => setShowMap(m => !m)}><MapIcon /> Map</button>
        </div>
      </div>

      {showMap && (
        <div className="card mapcard rise">
          <MapView points={mapPoints} onOpen={id => navigate(`/canteens/${id}`)} />
          {mapPoints.length < canteens.length && <small>{canteens.length - mapPoints.length} canteens aren't on the map yet. Open one and add its location.</small>}
        </div>
      )}

      {loading && <Loader label="Loading canteens" />}
      {pinError && <div className="canteen-pin-error"><p>Couldn't load your pinned canteens.</p><button type="button" className="mini" onClick={reloadPins}>Retry</button></div>}
      <div className={'clist' + (quiet ? ' noanim' : '')}>
        {matches.length > 0 && (
          <div className="card found rise">
            <h3>Where to get "{q.trim()}"</h3>
            {matches.map(f => {
              const [k, l] = ratingChip(f)
              return (
                <Link key={f.id} className="frow" to={`/canteens/${f.canteenId}/foods/${f.id}`}>
                  <b>{f.name}</b><span>{nameOf(f.canteenId)} · Rs {f.price}</span><span className={'rt ' + k}>{l}</span>
                </Link>
              )
            })}
          </div>
        )}
        {list.map((c, i) => {
          const voteShare = totalVotes ? Math.round((c.votes / totalVotes) * 100) : 0
          const open = isOpen(c,now)
          const status = canteenStatusLabel(c, now)
          const lastReport = lastReportLabel(c)
          const pinned = pinOrder.has(c.id)
          return (
            <div key={c.id} className="card canteen-list-item rise" style={{ '--i':Math.min(i,4) }}><Link className="ccard" to={`/canteens/${c.id}`} style={{ '--cc': c.colour }}>
              <CanteenThumb canteen={c} photo={thumbs[c.id]} />
              <div className="cb">
                <div className="row"><span className="cn">{c.name}</span><span className="vt"><b>{c.votes}</b> {c.votes === 1 ? 'vote' : 'votes'}</span></div>
                {c.knownFor && <small>Known for {c.knownFor.toLowerCase()}</small>}
                <small className="loc"><LocationIcon />{c.location}</small>
                <div><span className={'open ' + (open ? 'y' : 'n')}>{status} · {hourLabel(c.opensAt)} to {hourLabel(c.closesAt)}</span></div>
                {lastReport && <small><time dateTime={c.lastReportedAt}>{lastReport}</time></small>}
                <div className="canteen-vote-share">
                  <div className="bar" aria-hidden="true"><i style={{ '--w': `${voteShare}%` }} /></div>
                  <small>{voteShare}%<span className="sr"> of votes</span></small>
                </div>
              </div>
            </Link>
              <div className="canteen-card-actions">
                <button type="button" className="social-icon canteen-pin" aria-label={`Pin ${c.name}`} aria-pressed={pinned}
                  title={pinned ? 'Unpin canteen' : 'Pin canteen'} disabled={savingPin || pinsLoading || !!pinError} onClick={() => togglePin(c, !pinned)}>
                  <Pin size={18} aria-hidden="true" />
                </button>
                <button type="button" className="social-icon" aria-label={`Share ${c.name}`} onClick={async () => {
                  if (await shareLink(`/canteens/${c.id}`, `${c.name} · MoraPlates`) === 'copied') toast('Canteen link copied')
                }}><Share2 size={19} aria-hidden="true" /></button>
              </div>
            </div>
          )
        })}
        {!loading && !list.length && !matches.length && (
          <div className="card empty">
            <h3>{term ? `Nothing matches "${q.trim()}"` : 'No canteens open right now'}</h3>
            <p>{term ? "Try another food, or add it from a canteen's page." : 'Check back later, or see all canteens.'}</p>
          </div>
        )}
      </div>
    </div></div></section>
  )
}
