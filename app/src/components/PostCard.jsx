import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageOff, MapPin, Share2, Trash2 } from 'lucide-react'
import { Link } from './NavLinks'
import Dish from './Dish'
import Comments from './Comments'
import ContentPhoto from './ContentPhoto'
import PeopleListDialog from './PeopleListDialog'
import { CommentIcon, ForkKnifeIcon, HeartIcon, PencilIcon, SparkIcon } from './icons'
import { plural, RATING, timeAgo } from '../lib/format'
import Avatar from './Avatar'
import VerifiedBadge from './VerifiedBadge'
import { supabase } from '../lib/supabase'
import { useAuth, useModeration } from '../lib/auth'
import { playLikeSound, tapHaptic } from '../lib/feedback'
import { useFx } from '../lib/fx'
import { useFollowAction, usePost } from '../lib/post'
import { needsSquarePostFrame } from '../lib/postMedia'
import { moderateContent } from '../data/admin'
import { fetchPostLikers } from '../data/peopleLists'
import { deleteOwnPost, friendly } from '../data/queries'
import { shareLink, canteenMapLink } from '../lib/share'
import '../styles/post-card.css'

const TAP_TIME = 350
const TAP_MOVE = 12
const REACTION_DURATION = 720

function PostMedia({ photo, foodName, canteen, eager, reaction, onDoubleTap }) {
  const [square, setSquare] = useState(false)
  const pointer = useRef(null)
  const lastTap = useRef(null)
  const loading = eager ? 'eager' : 'lazy'
  const cancelTap = () => { pointer.current = null; lastTap.current = null }
  const startTap = e => {
    if (!onDoubleTap || !e.isPrimary || e.button !== 0) return cancelTap()
    pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp, type: e.pointerType }
  }
  const moveTap = e => {
    const tap = pointer.current
    if (tap?.id === e.pointerId && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_MOVE) cancelTap()
  }
  const endTap = e => {
    const tap = pointer.current
    pointer.current = null
    if (tap?.id !== e.pointerId || e.timeStamp - tap.time > TAP_TIME ||
        Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_MOVE) return cancelTap()
    const previous = lastTap.current
    if (previous?.type === tap.type && e.timeStamp - previous.time <= TAP_TIME &&
        Math.hypot(tap.x - previous.x, tap.y - previous.y) <= 36) {
      lastTap.current = null
      onDoubleTap?.()
    } else {
      lastTap.current = { ...tap, time: e.timeStamp }
    }
  }

  return <div className={'post-media' + (square ? ' square-frame' : '')}
    onPointerDown={startTap} onPointerMove={moveTap} onPointerUp={endTap} onPointerCancel={cancelTap}
    onPointerLeave={e => { if (pointer.current?.id === e.pointerId) cancelTap() }}>
    {photo ? <>
      {square && <ContentPhoto className="post-photo-blur" src={photo} alt="" aria-hidden="true" draggable={false} decoding="async" />}
      <ContentPhoto className="photo" src={photo} alt={foodName} loading={loading} decoding="async" draggable={false}
        onLoad={({ currentTarget: image }) => setSquare(needsSquarePostFrame(image.naturalWidth, image.naturalHeight))}/>
    </> : <Dish name={foodName} colour={canteen?.colour}/>}
    {reaction > 0 && <span key={reaction} className="plate-reaction" aria-hidden="true">
      <span className="plate-reaction-dish"><HeartIcon size={42}/><i/></span>
      <ForkKnifeIcon size={28} className="plate-reaction-cutlery"/>
      <SparkIcon size={23} className="plate-reaction-spark"/>
    </span>}
  </div>
}

export default function PostCard({ post, canteen, index = 0, showFollow = false, onLike, onSeen, onDeleted }) {
  const [label, cls] = RATING[post.rating] ?? ['Plate','']
  const [pops,setPops] = useState(0)
  const [reaction,setReaction] = useState(0)
  const [open,setOpen] = useState(false)
  const [likesOpen, setLikesOpen] = useState(false)
  const [commentCount,setCommentCount] = useState(post.comments ?? 0)
  const [busy,setBusy] = useState(false)
  const [deleted,setDeleted] = useState(false)
  const [removedPhotoPath,setRemovedPhotoPath] = useState(null)
  const card = useRef(null)
  const nextReaction = useRef(0)
  const { session } = useAuth()
  const { allowed } = useModeration()
  const { toast } = useFx()
  const { invalidate, openPostEdit, pendingLikes } = usePost()
  const loadLikers = useCallback(async (afterId, limit) => {
    await pendingLikes.get(post.id)
    return fetchPostLikers(post.id, afterId, limit)
  }, [pendingLikes, post.id])
  const userId = session?.user?.id
  const own = !!supabase && !!userId && userId === post.userId
  const followTarget = showFollow && userId && !own ? post.userId : null
  const { following, pending: followPending, setFollowing } = useFollowAction(followTarget, post.viewerFollows, post.followingReadAt)
  const authorPath = post.userId ? '/u/' + post.userId : '/people'
  const canDeletePost = own || allowed
  const photo = removedPhotoPath && post.photoPath === removedPhotoPath ? null : post.photo
  const canDeletePhoto = allowed && !!photo && !!post.photoPath
  useEffect(() => { setCommentCount(post.comments ?? 0) }, [post.id, post.comments])
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
  useEffect(() => {
    if (!reaction) return
    const timer = setTimeout(() => {
      setReaction(current => current === reaction ? 0 : current)
    }, REACTION_DURATION)
    return () => clearTimeout(timer)
  }, [reaction])

  const like = (doubleTap = false) => {
    const alreadyLiked = doubleTap && post.liked
    if (!alreadyLiked) {
      if (!onLike?.(post.id, doubleTap ? true : undefined)) return
      setPops(n => n + 1)
      tapHaptic()
      playLikeSound()
    }
    setReaction(++nextReaction.current)
  }
  const share = async path => {
    const result = await shareLink(path, post.food.name + ' · MoraPlates')
    if (result === 'copied') toast('Link copied')
  }
  const remove = async (photoOnly = false) => {
    if (busy || (photoOnly ? !canDeletePhoto : !canDeletePost)) return
    const target = photoOnly ? 'this photo' : photo ? 'this post and its photo' : 'this post'
    if (!window.confirm(`Delete ${target}? This cannot be undone.`)) return
    setBusy(true)
    try {
      const { storageRemoved } = photoOnly
        ? await moderateContent('post_photos', post.id, post.photoPath)
        : allowed ? await moderateContent('posts', post.id) : await deleteOwnPost(post.id, userId)
      if (photoOnly) setRemovedPhotoPath(post.photoPath)
      else {
        setDeleted(true)
        onDeleted?.()
      }
      invalidate()
      if (photoOnly) toast(storageRemoved ? 'Photo deleted' : 'Photo removed from the post. File cleanup needs attention.')
      else toast(storageRemoved ? 'Post deleted' : 'Post deleted. Photo cleanup needs attention.')
    } catch (error) {
      if (allowed) invalidate()
      toast(allowed ? error.message || 'Could not delete. Try again.' : friendly(error))
    } finally {
      setBusy(false)
    }
  }
  if (deleted) return null
  return <article ref={card} className="card post social-post rise" style={{'--i':Math.min(index,3)}}>
    <div className="pb ptop"><div className="ph">
      <div className="ph-who">
        <Link className="post-author-avatar" to={authorPath} tabIndex={-1} aria-label="View author profile">
          <Avatar name={post.author.name} url={post.author.avatar} />
        </Link>
        <div className="who">
          <div className="post-author-line">
            <Link className="post-author-link" to={authorPath}>
              <b>{post.author.name}{post.author.verified && <VerifiedBadge />}</b>
            </Link>
            {followTarget && following === false && (
              <button type="button" className="post-author-follow" disabled={followPending} aria-label={`Follow ${post.author.name}`}
                onClick={async () => { if (await setFollowing(true)) toast(`Following ${post.author.name}`) }}>+ Follow</button>
            )}
          </div>
          <small>{post.author.faculty ? post.author.faculty + ' · ' : ''}{timeAgo(post.createdAt)}</small>
        </div>
      </div>
      <span className={'rt '+cls}>{label}</span>
      {canDeletePost && <div className="post-manage-actions" role="group" aria-label={own ? 'Manage your post' : 'Manage post'}>
        {own && <button type="button" className="social-icon" disabled={busy} aria-label="Edit your post" title="Edit your post" onClick={() => openPostEdit(post)}>
          <PencilIcon size={19} />
        </button>}
        <button type="button" className="social-icon" disabled={busy} aria-label={own ? 'Delete your post' : 'Delete post'} title="Delete post" onClick={() => remove()}><Trash2 size={19} /></button>
      </div>}
    </div>{canteen && <Link className="post-location" to={'/canteens/'+canteen.id}><MapPin size={15}/>{canteen.name}</Link>}</div>
    <div className="post-media-wrap">
      <PostMedia key={photo ?? post.id} photo={photo} foodName={post.food.name} canteen={canteen} eager={index === 0} reaction={reaction} onDoubleTap={onLike && (() => like(true))}/>
      {canDeletePhoto && <button type="button" className="mini post-photo-delete" disabled={busy} onClick={() => remove(true)}>
        <ImageOff size={17} /> Delete photo
      </button>}
    </div>
    <div className="pb">
      <div className="acts">
        <div className="post-likes">
          <button className={'like post-like-toggle'+(post.liked?' on':'')+(post.liked&&pops?' pop':'')} type="button" aria-pressed={post.liked}
            aria-label={post.liked?'Unlike plate':'Like plate'} onClick={() => like()}><HeartIcon key={pops}/></button>
          {supabase && post.likes > 0 ? (
            <button className="post-like-count" type="button" aria-label={`View ${plural(post.likes, 'like')}`} aria-haspopup="dialog"
              title="See who liked this"
              onClick={() => setLikesOpen(true)}>{post.likes.toLocaleString()}</button>
          ) : <span className="post-like-count" aria-label={plural(post.likes, 'like')}>{post.likes.toLocaleString()}</span>}
        </div>
        <button className="like" aria-haspopup="dialog" aria-label="Comments" onClick={() => setOpen(true)}><CommentIcon/><span>{commentCount}</span></button>
        <button className="like" aria-label="Share post" onClick={()=>share('/posts/'+post.id)}><Share2 size={21}/><span>Share</span></button>
        {canteen && <button className="social-icon location-share" aria-label="Share canteen location" onClick={()=>share(canteenMapLink(canteen))}><MapPin size={20}/></button>}
      </div>
      <div className="post-food"><b>{post.food.name}</b><span>Rs {post.food.price}</span></div>
      {post.caption && <p className="post-caption"><b>{post.author.name}</b> {post.caption}</p>}
    </div>
    {open && <Comments key={post.id} postId={post.id} onClose={() => setOpen(false)}
      onCount={change => setCommentCount(count => Math.max(0, count + change))} />}
    {likesOpen && <PeopleListDialog key={post.id} title="Likes" emptyMessage="No likes yet."
      loadPage={loadLikers} onClose={() => setLikesOpen(false)} />}
  </article>
}
