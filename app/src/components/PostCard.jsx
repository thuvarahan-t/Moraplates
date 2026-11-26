import { useState } from 'react'
import { Link } from './NavLinks'
import Dish from './Dish'
import Comments from './Comments'
import { CommentIcon, HeartIcon } from './icons'
import { centreOf, confetti } from '../lib/fx'
import { initialsOf } from '../lib/auth'
import { avatarStyle, RATING, timeAgo } from '../lib/format'
import { supabase } from '../lib/supabase'

export default function PostCard({ post, canteen, index = 0, onLike }) {
  const [label, cls] = RATING[post.rating]
  const [pops, setPops] = useState(0)
  const [open, setOpen] = useState(false)
  const [extra, setExtra] = useState(0) // comments added or removed since load

  const like = e => {
    const svg = e.currentTarget.querySelector('svg')
    if (onLike(post.id)) {
      setPops(n => n + 1) // remounts the heart so the pop animation replays
      const [x, y] = centreOf(svg)
      confetti(x, y, 8)
    }
  }

  return (
    <article className="card post rise tilt" style={{ '--i': index }}>
      <div className="pb ptop">
        <div className="ph">
          <span className="av" style={avatarStyle(post.author.name)}>{initialsOf(post.author.name)}</span>
          <div className="who">
            <b>{post.author.name}</b>
            <small>{post.author.faculty ? post.author.faculty + ' · ' : ''}{timeAgo(post.createdAt)}</small>
          </div>
          <span className={'rt ' + cls}>{label}</span>
        </div>
      </div>
      {post.photo
        ? <img className="photo" src={post.photo} alt={`${post.food.name}${canteen ? ' at ' + canteen.name : ''}`} loading="lazy" />
        : <Dish name={post.food.name} colour={canteen?.colour} />}
      <div className="pb">
        <div className="tags">
          {canteen && <Link className="tag tc" to={`/canteens/${canteen.id}`}>{canteen.name}</Link>}
          <span className="tag">{post.food.name}</span>
          <span className="tag">Rs {post.food.price}</span>
        </div>
        {post.caption && <p>{post.caption}</p>}
        <div className="acts">
          <button
            className={'like' + (post.liked ? ' on' : '') + (post.liked && pops ? ' pop' : '')}
            aria-pressed={post.liked}
            aria-label="Like this plate"
            onClick={like}
          >
            <HeartIcon key={pops} /><span>{post.likes}</span>
          </button>
          {supabase && (
            <button className="like" aria-expanded={open} aria-label="Comments" onClick={() => setOpen(o => !o)}>
              <CommentIcon /><span>{(post.comments ?? 0) + extra}</span>
            </button>
          )}
        </div>
        {open && <Comments postId={post.id} onCount={d => setExtra(n => n + d)} />}
      </div>
    </article>
  )
}
