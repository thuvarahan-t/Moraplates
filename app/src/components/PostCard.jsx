import { useEffect, useRef, useState } from 'react'
import { Share2, Trash2, MapPin } from 'lucide-react'
import { Link } from './NavLinks'
import Dish from './Dish'
import Comments from './Comments'
import { CommentIcon, HeartIcon } from './icons'
import { RATING, timeAgo } from '../lib/format'
import Avatar from './Avatar'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useFx } from '../lib/fx'
import { usePost } from '../lib/post'
import { deleteOwnPost, friendly } from '../data/queries'
import { shareLink } from '../lib/share'

export default function PostCard({ post, canteen, index = 0, onLike, onSeen, onDeleted }) {
  const [label, cls] = RATING[post.rating] ?? ['Plate','']
  const [pops,setPops] = useState(0)
  const [open,setOpen] = useState(false)
  const [extra,setExtra] = useState(0)
  const [busy,setBusy] = useState(false)
  const [deleted,setDeleted] = useState(false)
  const card = useRef(null)
  const { session } = useAuth()
  const { toast } = useFx()
  const { invalidate } = usePost()
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
  const like = () => { if (onLike?.(post.id)) setPops(n=>n+1) }
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
  return <article ref={card} className="card post social-post rise" style={{'--i':Math.min(index,3)}}>
    <div className="pb ptop"><div className="ph">
      <Link className="ph-who" to={post.userId ? '/u/'+post.userId : '/people'}>
        <Avatar name={post.author.name} url={post.author.avatar}/>
        <span className="who"><b>{post.author.name}</b><small>{post.author.faculty ? post.author.faculty + ' · ' : ''}{timeAgo(post.createdAt)}</small></span>
      </Link>
      <span className={'rt '+cls}>{label}</span>
      {own && <button className="social-icon" disabled={busy} aria-label="Delete your post" onClick={remove}><Trash2 size={19}/></button>}
    </div>{canteen && <Link className="post-location" to={'/canteens/'+canteen.id}><MapPin size={15}/>{canteen.name}</Link>}</div>
    {post.photo ? <img className="photo" src={post.photo} alt={post.food.name} loading={index===0?'eager':'lazy'} decoding="async"/> : <Dish name={post.food.name} colour={canteen?.colour}/>}
    <div className="pb">
      <div className="acts">
        <button className={'like'+(post.liked?' on':'')+(post.liked&&pops?' pop':'')} aria-pressed={post.liked} aria-label={post.liked?'Unlike plate':'Like plate'} onClick={like}><HeartIcon key={pops}/><span>{post.likes}</span></button>
        <button className="like" aria-expanded={open} aria-label="Comments" onClick={()=>setOpen(v=>!v)}><CommentIcon/><span>{Math.max(0,(post.comments??0)+extra)}</span></button>
        <button className="like" aria-label="Share post" onClick={()=>share('/posts/'+post.id)}><Share2 size={21}/><span>Share</span></button>
        {canteen && <button className="social-icon location-share" aria-label="Share canteen location" onClick={()=>share('/canteens/'+canteen.id)}><MapPin size={20}/></button>}
      </div>
      <div className="post-food"><b>{post.food.name}</b><span>Rs {post.food.price}</span></div>
      {post.caption && <p className="post-caption"><b>{post.author.name}</b> {post.caption}</p>}
      {open && (supabase ? <Comments postId={post.id} onCount={d=>setExtra(n=>n+d)}/> : <p className="cm-empty">Comments are available when a live project is connected.</p>)}
    </div>
  </article>
}
