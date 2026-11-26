import { useEffect, useRef, useState } from 'react'
import { Link } from './NavLinks'
import Slideshow, { Credit, Dots } from './Slideshow'
import { ChevronIcon } from './icons'
import { useQuery } from '../data/useQuery'
import { fetchCanteenPhotos } from '../data/queries'
import { byVotes } from '../lib/food'
import { REDUCED_MOTION } from '../lib/motion'
import { supabase } from '../lib/supabase'

const PER_CANTEEN = 6
const NEXT_CANTEEN_MS = 6000

/**
 * Home page carousel: one slide per canteen that has photos, best-voted first.
 * Each slide cross-fades through that canteen's photos; the carousel moves on to
 * the next canteen every few seconds and can be swiped. Photos are added on the canteen page.
 */
export default function HomeBanner({ canteens }) {
  const { data: photos } = useQuery(() => (supabase ? fetchCanteenPhotos(null, 150) : Promise.resolve([])), [])
  const track = useRef(null)
  const [at, setAt] = useState(0)
  const paused = useRef(0)

  const ranked = [...canteens].sort(byVotes)
  const slides = ranked
    .map((c, r) => ({ c, rank: r + 1, photos: (photos ?? []).filter(p => p.canteenId === c.id).slice(0, PER_CANTEEN) }))
    .filter(s => s.photos.length)
  const n = slides.length

  const goTo = k => {
    const el = track.current
    if (el) el.scrollTo({ left: k * el.clientWidth, behavior: REDUCED_MOTION ? 'auto' : 'smooth' })
  }

  // Auto-advance; a touch or hover pauses it for a while.
  useEffect(() => {
    if (REDUCED_MOTION || n < 2) return
    const t = setInterval(() => {
      if (document.hidden || Date.now() < paused.current) return
      const el = track.current
      if (!el) return
      const k = (Math.round(el.scrollLeft / el.clientWidth) + 1) % n
      goTo(k)
    }, NEXT_CANTEEN_MS)
    return () => clearInterval(t)
  }, [n])

  if (!n) return null
  const hold = () => { paused.current = Date.now() + 10000 }

  return (
    <div className="bnr rise" onPointerEnter={hold} onTouchStart={hold}>
      <div className="bnr-track" ref={track} onScroll={e => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {slides.map(({ c, rank, photos: ph }) => (
          <Link key={c.id} className="bnr-slide" to={`/canteens/${c.id}`} aria-label={`${c.name}, see the canteen`}>
            <Slideshow photos={ph} interval={3200}>{cur => <Credit name={cur.by} />}</Slideshow>
            <div className="bnr-txt">
              {c.votes > 0 && <span className="pill">#{rank} this week</span>}
              <h2>{c.name}</h2>
              <p>{c.knownFor ? `Known for ${c.knownFor.toLowerCase()} · ` : ''}{c.location}</p>
            </div>
            <span className="bnr-go" aria-hidden="true"><ChevronIcon /></span>
          </Link>
        ))}
      </div>
      <Dots count={n} index={Math.min(at, n - 1)} goTo={k => { hold(); goTo(k) }} label="canteen" />
    </div>
  )
}
