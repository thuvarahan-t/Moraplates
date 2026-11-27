import { useEffect, useRef, useState } from 'react'
import { Share2, Trash2, MapPin } from 'lucide-react'
import { Link } from './NavLinks'
import Dish from './Dish'
import Comments from './Comments'
import { CommentIcon, HeartIcon, PencilIcon } from './icons'
import { RATING, timeAgo } from '../lib/format'
import Avatar from './Avatar'
import VerifiedBadge from './VerifiedBadge'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { playLikeSound, tapHaptic } from '../lib/feedback'
import { useFx } from '../lib/fx'
import { usePost } from '../lib/post'
import { needsSquarePostFrame } from '../lib/postMedia'
import { deleteOwnPost, friendly } from '../data/queries'
import { shareLink, canteenMapLink } from '../lib/share'
import '../styles/post-card.css'

const INTERACTIVE = 'a,button,input,textarea,select,label,[contenteditable],[role="button"],.cmts'
const TAP_TIME = 350
const TAP_MOVE = 12

function PostMedia({ post, canteen, eager, heart }) {
  const [square, setSquare] = useState(false)
  const loading = eager ? 'eager' : 'lazy'
  return <div className={'post-media' + (square ? ' square-frame' : '')}>
    {post.photo ? <>
      {square && <img className="post-photo-blur" src={post.photo} alt="" aria-hidden="true" draggable={false} decoding="async" />}
      <img className="photo" src={post.photo} alt={post.food.name} loading={loading} decoding="async" draggable={false}
        onLoad={({ currentTarget: image }) => setSquare(needsSquarePostFrame(image.naturalWidth, image.naturalHeight))}/>
    </> : <Dish name={post.food.name} colour={canteen?.colour}/>}
    {heart > 0 && <span key={heart} className="post-heart-feedback" aria-hidden="true"><HeartIcon size={64}/></span>}
  </div>
}

export default function PostCard({ post, canteen, index = 0, onLike, onSeen, onDeleted }) {
  const [label, cls] = RATING[post.rating] ?? ['Plate','']
  const [pops,setPops] = useState(0)
  const [hearts,setHearts] = useState(0)
  const [open,setOpen] = useState(false)
  const [extra,setExtra] = useState(0)
  const [busy,setBusy] = useState(false)
  const [deleted,setDeleted] = useState(false)
  const card = useRef(null)
  const pointer = useRef(null)
  const lastTap = useRef(null)
  const { session } = useAuth()
  const { toast } = useFx()
  const { invalidate, openPostEdit } = usePost()
  const own = !!supabase && session?.user?.id === post.userId
  useEffect(() => {
    if (!onSeen || !card.current || !('IntersectionObserver' in window)) return
    let timer
    const observer = new IntersectionObserver(entries => {
      clearTimeout(timer)
      if (entries[0]?.isIntersecting && entries[0].intersectionRatio >= 0.4 && document.visibilityState === 'visible') {
        timer = setTimeout(() => { if (document.visibilityState === 'visible') { onSeen(post.id); observer.disconnect() } }, 900)
      }
    },{threshold:0.4})
    observer.observe(card.current)
    return () => { clearTimeout(timer); observer.disconnect() }
  },[onSeen,post.id])
  const like = (doubleTap = false) => {
    if (!onLike?.(post.id, doubleTap ? true : undefined)) return
    setPops(n => n + 1)
    if (doubleTap) setHearts(n => n + 1)
    tapHaptic()
    playLikeSound()
  }
  const cancelTap = () => { pointer.current = null; lastTap.current = null }
  const startTap = e => {
    if (!onLike || !e.isPrimary || e.button !== 0 || e.target.closest?.(INTERACTIVE)) return cancelTap()
    pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp, type: e.pointerType }
  }
  const moveTap = e => {
    const tap = pointer.current
    if (tap?.id === e.pointerId && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_MOVE) cancelTap()
  }
  const endTap = e => {
    const tap = pointer.current
    pointer.current = null
    if (tap?.id !== e.pointerId || e.timeStamp - tap.time > TAP_TIME) return cancelTap()
    const previous = lastTap.current
    if (previous?.type === tap.type && e.timeStamp - previous.time <= TAP_TIME && Math.hypot(tap.x - previous.x, tap.y - previous.y) <= 36) {
      lastTap.current = null
      like(true)
    } else {
      lastTap.current = { ...tap, time: e.timeStamp }
    }
  }
  const share = async path => {
    const result = await shareLink(path, post.food.name + ' · MoraPlates')
    if (result === 'copied') toast('Link copied')
  }
  const remove = async () => {
    if (!own || busy || !window.confirm('Delete this plate and its photo? This cannot be undone.')) return
    setBusy(true)
    try {
      const result = await deleteOwnPost(post.id,session.user.id)
      setDeleted(true); onDeleted?.(); invalidate()
      toast(result.storageRemoved ? 'Plate and photo deleted' : 'Plate deleted; photo cleanup needs attention')
    } catch (e) { toast(friendly(e)); setBusy(false) }
  }
  if (deleted) return null
  return <article ref={card} className="card post social-post rise" style={{'--i':Math.min(index,3)}}
    onPointerDown={startTap} onPointerMove={moveTap} onPointerUp={endTap} onPointerCancel={cancelTap}
    onPointerLeave={e => { if (pointer.current?.id === e.pointerId) cancelTap() }}>
    <div className="pb ptop"><div className="ph">
      <Link className="ph-who" to={post.userId ? '/u/'+post.userId : '/people'}>
        <Avatar name={post.author.name} url={post.author.avatar}/>
        <span className="who"><b>{post.author.name}{post.author.verified && <VerifiedBadge />}</b><small>{post.author.faculty ? post.author.faculty + ' · ' : ''}{timeAgo(post.createdAt)}</small></span>
      </Link>
      <span className={'rt '+cls}>{label}</span>
      {own && <div className="post-owner-actions" role="group" aria-label="Manage your post">
        <button type="button" className="social-icon" disabled={busy} aria-label="Edit your post" title="Edit your post" onClick={() => openPostEdit(post)}>
          <PencilIcon size={19} />
        </button>
        <button type="button" className="social-icon" disabled={busy} aria-label="Delete your post" onClick={remove}><Trash2 size={19} /></button>
      </div>}
    </div>{canteen && <Link className="post-location" to={'/canteens/'+canteen.id}><MapPin size={15}/>{canteen.name}</Link>}</div>
    <PostMedia key={post.photo ?? post.id} post={post} canteen={canteen} eager={index === 0} heart={hearts}/>
    <div className="pb">
      <div className="acts">
        <button className={'like'+(post.liked?' on':'')+(post.liked&&pops?' pop':'')} aria-pressed={post.liked} aria-label={post.liked?'Unlike plate':'Like plate'} onClick={() => like()}><HeartIcon key={pops}/><span>{post.likes}</span></button>
        <button className="like" aria-expanded={open} aria-label="Comments" onClick={()=>setOpen(v=>!v)}><CommentIcon/><span>{Math.max(0,(post.comments??0)+extra)}</span></button>
        <button className="like" aria-label="Share post" onClick={()=>share('/posts/'+post.id)}><Share2 size={21}/><span>Share</span></button>
        {canteen && <button className="social-icon location-share" aria-label="Share canteen location" onClick={()=>share(canteenMapLink(canteen))}><MapPin size={20}/></button>}
      </div>
      <div className="post-food"><b>{post.food.name}</b><span>Rs {post.food.price}</span></div>
      {post.caption && <p className="post-caption"><b>{post.author.name}</b> {post.caption}</p>}
      {open && (supabase ? <Comments postId={post.id} onCount={d=>setExtra(n=>n+d)}/> : <p className="cm-empty">Comments are available when a live project is connected.</p>)}
    </div>
  </article>
}
