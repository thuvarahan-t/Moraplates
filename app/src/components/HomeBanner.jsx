import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import Dish from './Dish'
import { Link } from './NavLinks'
import Slideshow, { Credit, Dots } from './Slideshow'
import { ChevronIcon } from './icons'
import { useQuery } from '../data/useQuery'
import { CANTEEN_GALLERY_KEY, fetchCanteenGallery } from '../data/queries'
import { byVotes, withPrimaryPhoto } from '../lib/food'
import { REDUCED_MOTION } from '../lib/motion'
import { supabase } from '../lib/supabase'

const PER_CANTEEN = 6
const NEXT_CANTEEN_MS = 6000

/**
 * One slide per canteen, best-voted first. Each current slide can cross-fade through its gallery.
 */
export default function HomeBanner({ canteens }) {
  const { data: photos } = useQuery(CANTEEN_GALLERY_KEY, fetchCanteenGallery, { enabled: !!supabase })
  const track = useRef(null)
  const [at, setAt] = useState(0)
  const [playing, setPlaying] = useState(!REDUCED_MOTION)
  const [hovered, setHovered] = useState(false)

  const ranked = [...canteens].sort(byVotes)
  const slides = ranked.map(canteen => {
    const gallery = withPrimaryPhoto(canteen, (photos ?? []).filter(photo => photo.canteenId === canteen.id))
    const legacyPhoto = canteen.photo ? [{ id: canteen.id, url: canteen.photo }] : []
    return { canteen, photos: gallery.length ? gallery.slice(0, PER_CANTEEN) : legacyPhoto }
  })
  const n = slides.length
  const scroll = playing && !hovered
  const canPlay = n > 1 || slides.some(slide => slide.photos.length > 1)

  const goTo = k => {
    const el = track.current
    if (el) el.scrollTo({ left: k * el.clientWidth, behavior: REDUCED_MOTION ? 'auto' : 'smooth' })
  }

  useEffect(() => {
    if (!scroll || n < 2) return
    const t = setInterval(() => {
      if (document.hidden) return
      const el = track.current
      if (!el) return
      const k = (Math.round(el.scrollLeft / el.clientWidth) + 1) % n
      goTo(k)
    }, NEXT_CANTEEN_MS)
    return () => clearInterval(t)
  }, [n, scroll])

  if (!n) return null

  return (
    <section className="bnr rise" aria-label="Canteen slideshow"
      onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true) }}
      onPointerLeave={event => { if (event.pointerType === 'mouse') setHovered(false) }}
      onTouchStart={event => { if (!event.target.closest('.bnr-play')) setPlaying(false) }}
      onFocusCapture={event => {
        if (!event.target.closest('.bnr-play') && !event.currentTarget.contains(event.relatedTarget)) setPlaying(false)
      }}>
      {canPlay && !REDUCED_MOTION && <button type="button" className="bnr-play"
        aria-label={playing ? 'Pause canteen slideshow' : 'Play canteen slideshow'} onClick={() => setPlaying(value => !value)}>
        {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
      </button>}
      <div className="bnr-track" ref={track} onScroll={e => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {slides.map(({ canteen: c, photos: ph }, index) => (
          <Link key={c.id} className="bnr-slide" to={`/canteens/${c.id}`} aria-label={`${c.name}, see the canteen`}>
            {ph.length
              ? <Slideshow photos={ph} interval={3200} playing={scroll && index === at}>{cur => cur.by && <Credit name={cur.by} />}</Slideshow>
              : <div className="bnr-art" aria-hidden="true"><Dish name={c.knownFor || c.name} colour={c.colour} /></div>}
            <div className="bnr-txt">
              <h2>{c.name}</h2>
              <p>{c.knownFor ? `Known for ${c.knownFor.toLowerCase()} · ` : ''}{c.location}</p>
            </div>
            <span className="bnr-go" aria-hidden="true"><ChevronIcon /></span>
          </Link>
        ))}
      </div>
      <Dots count={n} index={Math.min(at, n - 1)} goTo={k => { setPlaying(false); goTo(k) }} label="canteen" />
    </section>
  )
}
