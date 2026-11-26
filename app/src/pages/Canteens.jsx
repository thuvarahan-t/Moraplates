import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Link } from '../components/NavLinks'
import MapView from '../components/MapView'
import CanteenThumb, { firstPhotoByCanteen } from '../components/CanteenThumb'
import { LocationIcon, MapIcon, PlusIcon, SearchIcon } from '../components/icons'
import { useHomeData } from '../data/useHomeData'
import { useQuery } from '../data/useQuery'
import { fetchCanteenPhotos } from '../data/queries'
import { supabase } from '../lib/supabase'
import { byVotes, hourLabel, isOpen, ratingChip, superPercent } from '../lib/food'
import { useSignInGate } from '../lib/useSignInGate'
import { plural } from '../lib/format'

const SORTS = [['votes', 'Top voted'], ['open', 'Open now'], ['cheap', 'Cheapest']]

/** Canteens ranked by this week's votes, food search, map (renderCanteens() in index.html). */
export default function Canteens() {
  const { data, loading } = useHomeData()
  const { canteens, foods } = data
  const navigate = useNavigate()
  const gate = useSignInGate()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('votes')
  const [quiet, setQuiet] = useState(false) // typing re-renders without replaying the rise animation
  const [showMap, setShowMap] = useState(false)
  const { data: photos } = useQuery(() => (supabase ? fetchCanteenPhotos(null, 150) : Promise.resolve([])), [])
  const thumbs = firstPhotoByCanteen(photos)

  const max = Math.max(1, ...canteens.map(c => c.votes))
  const minPrice = c => Math.min(...foods.filter(f => f.canteenId === c.id).map(f => f.price))
  const nameOf = id => canteens.find(c => c.id === id)?.name ?? ''

  const term = q.trim().toLowerCase()
  const matches = term ? foods.filter(f => f.name.toLowerCase().includes(term)).sort((a, b) => superPercent(b) - superPercent(a)) : []
  let list = sort === 'open' ? canteens.filter(isOpen) : [...canteens]
  list.sort(sort === 'cheap' ? (a, b) => (minPrice(a) - minPrice(b)) || 0 : byVotes) // empty menus sort last
  if (term) list = list.filter(c => c.name.toLowerCase().includes(term) || matches.some(f => f.canteenId === c.id))

  const pins = canteens.filter(c => c.lat != null).map(c => ({ id: c.id, lat: c.lat, lng: c.lng, label: c.name }))

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
          <MapView points={pins} onOpen={id => navigate(`/canteens/${id}`)} />
          {pins.length < canteens.length && <small>{canteens.length - pins.length} canteens aren't on the map yet. Open one and add its location.</small>}
        </div>
      )}

      <div className={'clist' + (quiet ? ' noanim' : '')}>
        {matches.length > 0 && (
          <div className="card found rise">
            <h3>Where to get "{q.trim()}"</h3>
            {matches.map(f => {
              const [k, l] = ratingChip(f)
              return (
                <Link key={f.id} className="frow" to={`/canteens/${f.canteenId}`}>
                  <b>{f.name}</b><span>{nameOf(f.canteenId)} · Rs {f.price}</span><span className={'rt ' + k}>{l}</span>
                </Link>
              )
            })}
          </div>
        )}
        {list.map((c, i) => {
          const open = isOpen(c)
          return (
            <Link key={c.id} className="card ccard rise tilt" to={`/canteens/${c.id}`} style={{ '--i': i, '--cc': c.colour }}>
              <CanteenThumb canteen={c} photo={thumbs[c.id]} />
              <div className="cb">
                <div className="row"><span className="cn">{c.name}</span><span className="vt"><b>{c.votes}</b> {c.votes === 1 ? 'vote' : 'votes'}</span></div>
                {c.knownFor && <small>Known for {c.knownFor.toLowerCase()}</small>}
                <small className="loc"><LocationIcon />{c.location}</small>
                <div><span className={'open ' + (open ? 'y' : 'n')}>{open ? 'Open now' : 'Closed'} · {hourLabel(c.opensAt)} to {hourLabel(c.closesAt)}</span></div>
                <div className="bar"><i style={{ '--w': Math.round((c.votes / max) * 100) + '%' }} /></div>
              </div>
            </Link>
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
