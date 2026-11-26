import { useState } from 'react'
import PostCard from './PostCard'
import Loader from './Loader'
import { useFeed } from '../data/feed'
import { usePost } from '../lib/post'

const SORTS = [['new', 'Latest'], ['hot', 'Most liked']]

/** Filter chips + post grid (renderFeed() in index.html). */
export default function FeedSection({ canteens }) {
  const { posts, loading, toggleLike } = useFeed()
  const { openPost } = usePost()
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('new')

  const byId = Object.fromEntries(canteens.map(c => [c.id, c]))
  const list = posts
    .filter(p => filter === 'all' || p.canteenId === filter)
    .sort(sort === 'hot' ? (a, b) => b.likes - a.likes : (a, b) => b.createdAt - a.createdAt)

  const chip = (on, label, onClick) => (
    <button key={label} className={'chip' + (on ? ' on' : '')} aria-pressed={on} onClick={onClick}>{label}</button>
  )

  return (
    <div id="feed">
      <div className="chips scroll">
        {[['all', 'All canteens'], ...canteens.map(c => [c.id, c.name])].map(([id, n]) => chip(filter === id, n, () => setFilter(id)))}
        <span className="sp" />
        {SORTS.map(([id, n]) => chip(sort === id, n, () => setSort(id)))}
      </div>
      {loading && <Loader label="Loading plates" />}
      {/* Keyed so the cards replay their staggered rise whenever the filter or sort changes. */}
      <div className="posts" key={filter + sort}>
        {list.map((p, i) => <PostCard key={p.id} post={p} canteen={byId[p.canteenId]} index={i} onLike={toggleLike} />)}
        {!loading && !list.length && (
          <div className="card empty rise">
            <h3>No plates here yet</h3>
            <p>Be the first to post what you ate at this canteen today.</p>
            <button className="btn sm" onClick={openPost}>Post your plate</button>
          </div>
        )}
      </div>
    </div>
  )
}
