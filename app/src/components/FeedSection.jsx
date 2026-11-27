import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import People from './People'
import PostCard from './PostCard'
import Loader from './Loader'
import { useFeed } from '../data/feed'
import { usePost } from '../lib/post'

const SORTS = [['new', 'Latest'], ['hot', 'Most liked']]

/** Filter chips + post grid (renderFeed() in index.html). */
export default function FeedSection({ canteens }) {
  const { posts, loading, toggleLike, error, more, loadingMore, loadMore, markSeen, refresh } = useFeed()
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
      <div className="feed-heading"><h2>Fresh plates</h2><button type="button" className="mini" onClick={refresh} disabled={loading}><RefreshCw size={16}/> Refresh</button></div>
      <div className="chips scroll">
        {[['all', 'All canteens'], ...canteens.map(c => [c.id, c.name])].map(([id, n]) => chip(filter === id, n, () => setFilter(id)))}
        <span className="sp" />
        {SORTS.map(([id, n]) => chip(sort === id, n, () => setSort(id)))}
      </div>
      <div className="mobile-people"><People compact /></div>
      {loading && <Loader label="Loading plates" />}
      {error && <div className="card empty"><h3>Couldn't load plates</h3><button className="btn sm" onClick={refresh}>Retry</button></div>}
      {/* Keyed so the cards replay their staggered rise whenever the filter or sort changes. */}
      <div className="posts" key={filter + sort}>
        {list.map((p, i) => <PostCard key={p.id} post={p} canteen={byId[p.canteenId]} index={i} onLike={toggleLike} onSeen={markSeen} />)}
        {!loading && !error && !list.length && (
          <div className="card empty rise">
            <h3>You're caught up</h3>
            <p>Seen plates remain on their author's profile. Try another canteen, load more, or share your own plate.</p>
            <button className="btn sm" onClick={openPost}>Post your plate</button>
          </div>
        )}
      </div>
      {more && <button className="btn ghost wide" disabled={loadingMore} onClick={loadMore}>{loadingMore ? "Loading…" : "Load more plates"}</button>}
    </div>
  )
}
