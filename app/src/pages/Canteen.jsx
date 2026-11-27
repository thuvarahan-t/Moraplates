import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Navigation, Share2 } from 'lucide-react'
import CanteenClosure from '../components/CanteenClosure'
import { exportPhoto } from '../lib/photoEdit'
import { shareLink, canteenMapLink } from '../lib/share'
import { supabase } from '../lib/supabase'
import { SAMPLE_CANTEENS, SAMPLE_FOODS } from '../data/sample'
import { samplePosts } from '../data/feed'
import { useParams } from 'react-router'
import { Link } from '../components/NavLinks'
import CountUp from '../components/CountUp'
import Loader from '../components/Loader'
import Dish from '../components/Dish'
import MapView, { locate } from '../components/MapView'
import PostCard from '../components/PostCard'
import { BackIcon, CameraIcon, CheckIcon, HeartIcon, MapIcon, PinIcon, TrashIcon } from '../components/icons'
import Slideshow, { Credit, Dots } from '../components/Slideshow'
import { useQuery } from '../data/useQuery'
import { queryKey } from '../data/queryCache'
import { addCanteenPhoto, addFood, pinCanteen, castVote, deleteCanteenPhoto, fetchCanteenPage, friendly, removeVote, reportCanteenStatus } from '../data/queries'
import { useLikeToggle } from '../data/feed'
import { useAuth } from '../lib/auth'
import { centreOf, useFx } from '../lib/fx'
import { usePost } from '../lib/post'
import { useSignInGate } from '../lib/useSignInGate'
import { REDUCED_MOTION } from '../lib/motion'
import { plural } from '../lib/format'
import { canteenSuper, hourLabel, isOpen, isReportedClosed, isReportedOpen, percent, ratingChip, superPercent, totalRatings } from '../lib/food'

/** One canteen: vote, menu, add food, latest plates (renderCanteen() in index.html). */
export default function Canteen() {
  const { id } = useParams()
  const { session } = useAuth()
  const uid = session?.user?.id
  const { data, loading, error } = useQuery(queryKey('canteen', id), () => supabase ? fetchCanteenPage(id, uid) : Promise.resolve((()=>{const c=SAMPLE_CANTEENS.find(x=>x.id===id);return c?{canteen:c,rank:1+SAMPLE_CANTEENS.filter(x=>x.votes>c.votes).length,foods:SAMPLE_FOODS.filter(f=>f.canteenId===id),posts:samplePosts().filter(p=>p.canteenId===id),myVote:null,photos:[]}:null})()))
  const { toast, confetti } = useFx()
  const { openPost, invalidate } = usePost()
  const gate = useSignInGate()
  const voteBtn = useRef(null)
  const photoInput = useRef(null)
  const [voting, setVoting] = useState(false)
  const [localVote,setLocalVote]=useState(null)
  useEffect(()=>{if(data)setLocalVote({id:data.myVote,votes:data.canteen.votes})},[data])
  const [photoBusy, setPhotoBusy] = useState(false)
  const [reportBusy,setReportBusy]=useState(false)
  const [now,setNow]=useState(Date.now())
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),30_000);return()=>clearInterval(t)},[])

  // Local copy of the latest posts so likes can update optimistically.
  const [posts, setPosts] = useState(() => data?.posts ?? [])
  const postsRef = useRef(posts)
  postsRef.current = posts
  useEffect(() => { if (data) setPosts(data.posts) }, [data])
  const toggleLike = useLikeToggle(postsRef, setPosts)

  if (loading && !data) return <section className="view"><div className="band"><div className="wrap"><Back /><Loader label="Loading canteen" /></div></div></section>
  if (error || !data) {
    return (
      <section className="view"><div className="band"><div className="wrap">
        <Back />
        <div className="card empty"><h3>{error ? "Couldn't load this canteen" : 'Canteen not found'}</h3><p>{error ? 'Check your connection and try again.' : 'It may have been removed.'}</p></div>
      </div></div></section>
    )
  }

  const { canteen: c, rank, foods, myVote, photos } = data
  const menu = [...foods].sort((a, b) => superPercent(b) - superPercent(a) || totalRatings(b) - totalRatings(a))
  const currentVote=localVote?localVote.id:myVote
  const voteCount=localVote?.votes??c.votes
  const fav = currentVote === c.id
  const open = isOpen(c,now)
  const reported = isReportedClosed(c,now)
  const reportedOpen = isReportedOpen(c, now)
  const status = reported ? 'Reported closed' : reportedOpen ? 'Reported open' : open ? 'Open now' : 'Closed'
  const directions = c.lat != null && c.lng != null ? canteenMapLink(c) : null
  const photoActionLabel = photoBusy ? 'Uploading photo…' : 'Add photo'
  const share = async()=>{if(await shareLink('/canteens/'+c.id,c.name+' · MoraPlates')==='copied')toast('Canteen link copied')}
  const closure = async action => {
    if (reportBusy || !gate('to report canteen hours')) return
    setReportBusy(true)
    try {
      await reportCanteenStatus(c.id, action)
      setNow(Date.now())
      toast(action === 'open' ? 'Canteen reported open' : '60-minute closure report submitted')
      invalidate()
    } catch (e) {
      toast(friendly(e))
    } finally {
      setReportBusy(false)
    }
  }
  const ratings = foods.reduce((n, f) => n + totalRatings(f), 0)

  const vote = async () => {
    if (!gate('to vote') || voting) return
    setVoting(true)
    const previous={id:currentVote,votes:voteCount}
    setLocalVote({id:fav?null:c.id,votes:Math.max(0,voteCount+(fav?-1:1))})
    try {
      if (fav) {
        await removeVote()
        toast('Vote removed')
      } else {
        await castVote(c.id)
        if (voteBtn.current) {
          const [x, y] = centreOf(voteBtn.current)
          confetti(x, y, 24)
        }
        toast('You voted for ' + c.name)
      }
      invalidate()
      if (!REDUCED_MOTION) voteBtn.current?.animate([{ transform: 'scale(.9)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'ease-out' })
    } catch (e) {
      setLocalVote(previous)
      toast(friendly(e))
    } finally {
      setVoting(false)
    }
  }

  const addPhoto = async picked => {
    if (!picked || !uid) return
    setPhotoBusy(true)
    try {
      const file = await exportPhoto(picked, { fixedAspect: 4 / 3 })
      await addCanteenPhoto(uid, c.id, file)
      toast('Photo added to ' + c.name)
      invalidate()
    } catch (err) {
      toast(friendly(err))
    } finally {
      setPhotoBusy(false)
    }
  }

  const deletePhoto = async p => {
    if (!window.confirm('Delete this photo?')) return
    try {
      const ok=await deleteCanteenPhoto(p)
      toast(ok?'Photo deleted':'Photo removed from gallery; storage cleanup needs attention')
      invalidate()
    } catch (err) {
      toast(friendly(err))
    }
  }

  const closurePanel = <CanteenClosure canteen={c} reported={reported} reportedOpen={reportedOpen} busy={reportBusy} onAction={closure} />

  const info = (
    <div className="ctx">
      {c.votes > 0 && <span className="pill">#{rank} this week</span>}
      <h2>{c.name}</h2>
      <p>{c.location} · <span className={'open ' + (open ? 'y' : 'n')}>{status}, {hourLabel(c.opensAt)} to {hourLabel(c.closesAt)}</span></p>
      {c.knownFor && <p>Known for {c.knownFor.toLowerCase()}</p>}
      <div className="cacts canteen-actions">
        <button ref={voteBtn} className={'btn' + (fav ? ' voted' : '')} aria-pressed={fav} onClick={vote} disabled={voting}>
          {fav ? <><CheckIcon />Your favourite canteen</> : <><HeartIcon />Vote as my favourite</>}
        </button>
        <div className="canteen-action-icons" role="group" aria-label="Canteen actions">
          <button type="button" className="social-icon" aria-label={photoActionLabel} title={photoActionLabel} disabled={photoBusy}
            onClick={() => { if (gate('to add photos')) photoInput.current?.click() }}>
            {photoBusy ? <LoaderCircle className="canteen-photo-spinner" size={19} aria-hidden="true" /> : <CameraIcon size={19} />}
          </button>
          <input ref={photoInput} type="file" accept="image/*" aria-label="Add canteen photo" disabled={photoBusy} hidden
            onChange={e => {
              const file = e.currentTarget.files?.[0]
              e.currentTarget.value = ''
              if (file) addPhoto(file)
            }} />
          <button type="button" className="social-icon" aria-label="Share" title="Share" onClick={share}>
            <Share2 size={19} aria-hidden="true" />
          </button>
          {directions && <a className="social-icon" href={directions} target="_blank" rel="noreferrer" aria-label="Directions" title="Directions">
            <Navigation size={19} aria-hidden="true" />
          </a>}
        </div>
      </div>
      {!photos.length && closurePanel}
    </div>
  )

  return (
    <section className="view"><div className="band"><div className="wrap">
      <Back />
      {photos.length ? (
        <div className="cbanner rise">
          <div className="cbanner-photo">
            <Slideshow photos={photos}>
              {(cur, i, goTo) => (
                <>
                  <Credit name={cur.by} />
                  {cur.userId === uid && (
                    <button className="gbtn ptrash" onClick={() => deletePhoto(cur)} aria-label="Delete this photo" title="Delete your photo"><TrashIcon /></button>
                  )}
                  <Dots count={photos.length} index={i} goTo={goTo} />
                </>
              )}
            </Slideshow>
          </div>
          {info}
          <div className="cbanner-report">{closurePanel}</div>
        </div>
      ) : (
        <div className="card chero rise" style={{ '--cc': c.colour }}>
          <Dish name={c.knownFor || menu[0]?.name || c.name} colour={c.colour} />
          {info}
        </div>
      )}

      <div className="stats rise" style={{ '--i': 1 }}>
        <div><CountUp to={voteCount} /><span>votes this week</span></div>
        <div><CountUp to={canteenSuper(foods)} suffix="%" /><span>ratings say Super</span></div>
        <div><CountUp to={ratings} /><span>ratings</span></div>
        <div><CountUp to={foods.length} /><span>foods on the menu</span></div>
      </div>

      <div className="two">
        <div className="card menu rise" style={{ '--i': 2 }}>
          <div className="mh"><h3>Menu</h3><span>Sorted by how many say Super</span></div>
          {menu.map(f => {
            const [k, l] = ratingChip(f)
            return (
              <div className="mrow" key={f.id}>
                <div className="mi">
                  <b>{f.name}</b>
                  <small>Rs {f.price} · {plural(totalRatings(f), 'rating')}</small>
                  <div className="s3" aria-hidden="true">
                    <i className="s" style={{ '--w': percent(f, 'superCount') + '%' }} />
                    <i className="o" style={{ '--w': percent(f, 'okayCount') + '%' }} />
                    <i className="a" style={{ '--w': percent(f, 'avoidCount') + '%' }} />
                  </div>
                </div>
                <span className={'rt ' + k}>{l}</span>
                <button className="mini" onClick={() => openPost(c.id, f.id)} aria-label={`Post a plate of ${f.name}`}>Post</button>
              </div>
            )
          })}
          {!menu.length && <p style={{ color: 'var(--mut)', padding: '12px 0' }}>No foods yet. Add the first one below.</p>}
          <AddFood canteenId={c.id} names={foods.map(f => f.name.toLowerCase())} onAdded={invalidate} />
        </div>

        <div className="side rise" style={{ '--i': 3 }}>
          {c.lat != null ? (
            <div className="card mapcard">
              <MapView points={[{ id: c.id, lat: c.lat, lng: c.lng, label: c.name }]} height={220} />
            </div>
          ) : (
            <PinIt canteen={c} onPinned={invalidate} />
          )}
          <h3>Latest from here</h3>
          {posts.slice(0, 2).map(p => <PostCard key={p.id} post={p} canteen={c} onLike={toggleLike} />)}
          {!posts.length && (
            <div className="card empty">
              <h3>No plates yet</h3><p>Post the first plate from {c.name}.</p>
              <button className="btn sm" onClick={() => openPost(c.id)}>Post your plate</button>
            </div>
          )}
        </div>
      </div>
    </div></div></section>
  )
}

const Back = () => <Link className="back" to="/canteens"><BackIcon />All canteens</Link>

/** Canteens without a location: the first student who knows where it is drops the pin. */
function PinIt({ canteen, onPinned }) {
  const { toast } = useFx()
  const gate = useSignInGate()
  const [open, setOpen] = useState(false)
  const [spot, setSpot] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!spot) return setErr('Tap the map where the canteen is.')
    setBusy(true)
    try {
      const ok = await pinCanteen(canteen.id, spot.lat, spot.lng)
      toast(ok ? canteen.name + ' is on the map now' : 'Someone pinned it just before you')
      onPinned()
    } catch (e) {
      setErr(friendly(e))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className="card pinit">
        <span className="si"><MapIcon size={22} /></span>
        <div><b>Not on the map yet</b><small>Know where {canteen.name} is? Drop the pin for everyone.</small></div>
        <button className="btn sm ghost" onClick={() => gate('to pin canteens') && setOpen(true)}><PinIcon />Pin it</button>
      </div>
    )
  }
  return (
    <div className="card mapcard pinit-open">
      <MapView value={spot} onPick={p => { setSpot(p); setErr('') }} height={260} />
      <div className="maprow">
        <small>{spot ? 'Drag the pin to adjust, then save.' : 'Tap the map where the canteen is.'}</small>
        <button type="button" className="mini" onClick={async () => { try { setSpot(await locate()) } catch (e) { setErr(e.message) } }}><PinIcon /> My location</button>
      </div>
      <p className="err" role="alert">{err}</p>
      <div className="cacts">
        <button className="btn sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save location'}</button>
        <button className="btn sm ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

function AddFood({ canteenId, names, onAdded }) {
  const { toast } = useFx()
  const gate = useSignInGate()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async e => {
    e.preventDefault()
    const n = name.trim(), p = Math.round(+price)
    if (!n) return setErr('Enter the food name.')
    if (!(p > 0 && p <= 5000)) return setErr('Enter a price between Rs 1 and Rs 5000.')
    if (names.includes(n.toLowerCase())) return setErr('That food is already on the menu.')
    if (!gate('to add foods')) return
    setBusy(true)
    try {
      await addFood(canteenId, n, p)
      setName(''); setPrice('')
      toast(n + ' added to the menu')
      onAdded()
    } catch (e2) {
      setErr(friendly(e2))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="addf" noValidate onSubmit={submit}>
      <b>Missing something on the menu?</b>
      <div className="afr">
        <label className="fl"><span>Food name</span><input maxLength={40} placeholder="Cheese kottu" value={name} onChange={e => { setName(e.target.value); setErr('') }} /></label>
        <label className="fl" style={{ flex: '0 1 130px' }}><span>Price (Rs)</span><input type="number" min="1" max="5000" inputMode="numeric" placeholder="450" value={price} onChange={e => { setPrice(e.target.value); setErr('') }} /></label>
        <button className="btn sm" disabled={busy}>Add food</button>
      </div>
      <p className="err" role="alert">{err}</p>
    </form>
  )
}
