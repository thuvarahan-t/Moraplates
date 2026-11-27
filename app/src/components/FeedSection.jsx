import { useId, useState } from 'react'
import { CircleCheck, RefreshCw } from 'lucide-react'
import Dropdown from './Dropdown'
import People from './People'
import PostCard from './PostCard'
import Loader from './Loader'
import { useFeed } from '../data/feed'
import { usePost } from '../lib/post'

const SORTS = [{ value: 'new', label: 'Latest' }, { value: 'hot', label: 'Most liked' }]

export default function FeedSection({ canteens }) {
  const { openPost } = usePost()
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('new')
  const filterLabelId = useId()
  const sortLabelId = useId()
  const byId = Object.fromEntries(canteens.map(c => [c.id, c]))
  const canteenId = byId[filter]?.id
  const { posts, loading, toggleLike, error, more, loadingMore, pageError, caughtUp, loadMore, markSeen, refresh } = useFeed(canteenId)
  const list = [...posts].sort(sort === 'hot' ? (a, b) => b.likes - a.likes : (a, b) => b.createdAt - a.createdAt)

  return (
    <div id="feed">
      <div className="feed-heading"><h2>Fresh plates</h2><button type="button" className="mini" onClick={refresh} disabled={loading}><RefreshCw size={16}/> Refresh</button></div>
      <div className="feed-filters">
        <span className="sr" id={filterLabelId}>Canteen</span>
        <Dropdown labelId={filterLabelId} value={canteenId ?? 'all'} onChange={setFilter}
          options={[{ value: 'all', label: 'All canteens' }, ...canteens.map(c => ({ value: c.id, label: c.name }))]} />
        <span className="sr" id={sortLabelId}>Sort posts</span>
        <Dropdown labelId={sortLabelId} value={sort} options={SORTS} onChange={setSort} />
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
