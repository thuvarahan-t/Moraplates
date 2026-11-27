import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from './NavLinks'
import { Credit } from './Slideshow'
import { useQuery } from '../data/useQuery'
import { fetchHomeCanteenPhotos } from '../data/queries'
import { homeCanteenSlides } from '../lib/food'
import { REDUCED_MOTION } from '../lib/motion'
import { supabase } from '../lib/supabase'

const NEXT_PHOTO_MS = 5000
const scrollIndex = el => Math.round(el.scrollLeft / el.clientWidth)

export default function HomeBanner({ canteens }) {
  const { data: photos } = useQuery('home-canteen-photos', fetchHomeCanteenPhotos, { enabled: !!supabase })
  const track = useRef(null)
  const target = useRef(null)
  const [at, setAt] = useState(0)
  const slides = homeCanteenSlides(canteens, photos)
  const count = slides.length
  const active = Math.min(at, count - 1)

  const move = useCallback(direction => {
    const el = track.current
    if (!el?.clientWidth || count < 2) return
    const current = Math.max(0, Math.min(target.current ?? scrollIndex(el), count - 1))
    const next = (current + direction + count) % count
    const wraps = current + direction !== next
    target.current = next
    el.scrollTo({ left: next * el.clientWidth, behavior: REDUCED_MOTION || wraps ? 'auto' : 'smooth' })
  }, [count])

  useEffect(() => {
    if (REDUCED_MOTION || count < 2) return
    const timer = setInterval(() => {
      if (!document.hidden && !track.current?.parentElement.querySelector(':focus-visible')) move(1)
    }, NEXT_PHOTO_MS)
    return () => clearInterval(timer)
  }, [active, count, move])

  if (!count) return null

  function updatePosition(event) {
    const el = event.currentTarget
    if (!el.clientWidth) return
    if (target.current !== null && Math.abs(el.scrollLeft - target.current * el.clientWidth) < 1) target.current = null
    setAt(Math.max(0, scrollIndex(el)))
  }

  return (
    <section className="bnr rise" aria-label="Canteen slideshow">
      <div className="bnr-track" ref={track} onScroll={updatePosition}
        onPointerDown={() => { target.current = null }} onWheel={() => { target.current = null }}>
        {slides.map(({ canteen, photo }, index) => (
          <Link key={photo.id} className="bnr-slide" to={`/canteens/${canteen.id}`}
            aria-label={`${canteen.name}, see the canteen`} aria-hidden={index !== active}
            tabIndex={index === active ? undefined : -1}>
            <img className="bnr-photo" src={photo.url} alt="" loading={index === 0 ? 'eager' : 'lazy'} />
            {photo.by && <Credit name={photo.by} />}
            <div className="bnr-txt">
              <h2>{canteen.name}</h2>
              <p>{canteen.knownFor ? `Known for ${canteen.knownFor.toLowerCase()} · ` : ''}{canteen.location}</p>
            </div>
          </Link>
        ))}
      </div>
      {count > 1 && <>
        <button className="bnr-arrow bnr-prev" type="button" aria-label="Previous photo" onClick={() => move(-1)}><ChevronLeft aria-hidden="true" /></button>
        <button className="bnr-arrow bnr-next" type="button" aria-label="Next photo" onClick={() => move(1)}><ChevronRight aria-hidden="true" /></button>
      </>}
    </section>
  )
}
