import { useState } from 'react'
import { CircleCheck, RefreshCw } from 'lucide-react'
import People from './People'
import PostCard from './PostCard'
import Loader from './Loader'
import { ChevronDownIcon } from './icons'
import { useFeed } from '../data/feed'
import { usePost } from '../lib/post'

const SORTS = [['new', 'Latest'], ['hot', 'Most liked']]

export default function FeedSection({ canteens }) {
  const { openPost } = usePost()
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('new')
  const byId = Object.fromEntries(canteens.map(c => [c.id, c]))
  const canteenId = byId[filter]?.id
  const { posts, loading, toggleLike, error, more, loadingMore, pageError, caughtUp, loadMore, markSeen, refresh } = useFeed(canteenId)
  const list = [...posts].sort(sort === 'hot' ? (a, b) => b.likes - a.likes : (a, b) => b.createdAt - a.createdAt)

  return (
    <div id="feed">
      <div className="feed-heading"><h2>Fresh plates</h2><button type="button" className="mini" onClick={refresh} disabled={loading}><RefreshCw size={16}/> Refresh</button></div>
      <div className="feed-filters">
        <div className="feed-select">
          <select aria-label="Canteen" value={canteenId ?? 'all'} onChange={e => setFilter(e.target.value)}>
            <option value="all">All canteens</option>
            {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDownIcon size={16} />
        </div>
        <div className="feed-select">
          <select aria-label="Sort posts" value={sort} onChange={e => setSort(e.target.value)}>
            {SORTS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <ChevronDownIcon size={16} />
        </div>
      </div>
      <div className="mobile-people"><People compact /></div>
      {loading && <Loader label="Loading plates" />}
      {error && <div className="card empty"><h3>Couldn't load plates</h3><button className="btn sm" onClick={refresh}>Retry</button></div>}
      {caughtUp && list.length > 0 && (
        <div className="feed-caught-up">
          <CircleCheck size={22} aria-hidden="true" />
          <div><h3>You're all caught up</h3><p>Enjoy some past plates.</p></div>
        </div>
      )}
      <div className="posts">
        {list.map((p, i) => <PostCard key={p.id} post={p} canteen={byId[p.canteenId]} index={i} onLike={toggleLike} onSeen={caughtUp ? undefined : markSeen} />)}
        {!loading && !error && !list.length && (
          <div className="card empty rise">
            <h3>No plates yet</h3>
            <button className="btn sm" onClick={openPost}>Post your plate</button>
          </div>
        )}
      </div>
      {(more || loadingMore || pageError) && (
        <button type="button" className="btn ghost wide" disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? 'Loading plates…' : pageError ? 'Retry loading plates' : 'Load more plates'}
        </button>
      )}
    </div>
  )
}
