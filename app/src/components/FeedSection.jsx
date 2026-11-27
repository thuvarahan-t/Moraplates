import { useEffect, useId, useRef, useState } from 'react'
import { CircleCheck, RefreshCw } from 'lucide-react'
import Dropdown from './Dropdown'
import People from './People'
import PostCard from './PostCard'
import Loader from './Loader'
import { useFeed } from '../data/feed'
import { usePost } from '../lib/post'

const SORTS = [{ value: 'new', label: 'Latest' }, { value: 'hot', label: 'Most liked' }]

function usePostOrder(posts, freshCount, scope, sort) {
  const [order, setOrder] = useState(null)
  const sameOrder = order?.scope === scope && order.sort === sort && order.ids.length <= posts.length
  let ids = sameOrder ? order.ids : []
  if (!sameOrder || ids.length !== posts.length) {
    // Rerank the loaded cards when the sort changes, then keep later batches below them.
    const compare = sort === 'hot' ? (a, b) => b.likes - a.likes : (a, b) => b.createdAt - a.createdAt
    const split = Math.max(ids.length, freshCount)
    const freshIds = posts.slice(ids.length, split).sort(compare).map(p => p.id)
    const pastIds = posts.slice(split).sort(compare).map(p => p.id)
    ids = [...ids, ...freshIds, ...pastIds]
    setOrder({ scope, sort, ids })
  }
  const byId = new Map(posts.map(p => [p.id, p]))
  return ids.map(id => byId.get(id))
}

export default function FeedSection({ canteens }) {
  const { openPost } = usePost()
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('new')
  const filterLabelId = useId()
  const sortLabelId = useId()
  const feedEnd = useRef(null)
  const byId = Object.fromEntries(canteens.map(c => [c.id, c]))
  const canteenId = byId[filter]?.id
  const { posts, scope, loading, toggleLike, error, more, loadingMore, pageError, caughtUp, freshCount, awaitingHistory, loadMore, markSeen, refresh } = useFeed(canteenId)
  const ordered = usePostOrder(posts, freshCount, scope, sort)
  const fresh = ordered.slice(0, freshCount)
  const past = ordered.slice(freshCount)
  const canObserve = typeof IntersectionObserver === 'function'

  useEffect(() => {
    const target = feedEnd.current
    if (!canObserve || !target || !more || loadingMore || pageError) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore()
    }, { rootMargin: awaitingHistory ? '0px' : '0px 0px 1000px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [canObserve, more, loadingMore, pageError, awaitingHistory, loadMore])

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
      <div className="posts">
        {fresh.map((p, i) => <PostCard key={p.id} post={p} canteen={byId[p.canteenId]} index={i} onLike={toggleLike} onSeen={markSeen} />)}
        {caughtUp && posts.length > 0 && (
          <div className="feed-caught-up">
            <CircleCheck size={22} aria-hidden="true" />
            <div><h3>You're all caught up</h3>{past.length > 0 && <p>Enjoy some past plates.</p>}</div>
          </div>
        )}
        {past.map((p, i) => <PostCard key={p.id} post={p} canteen={byId[p.canteenId]} index={freshCount + i} onLike={toggleLike} />)}
        {!loading && !error && !posts.length && (
          <div className="card empty rise">
            <h3>No plates yet</h3>
            <button className="btn sm" onClick={openPost}>Post your plate</button>
          </div>
        )}
      </div>
      {more && <div ref={feedEnd} className="feed-page-status">
        {loadingMore && <p role="status">Loading more plates…</p>}
        {!loadingMore && (pageError || !canObserve) && (
          <button type="button" className="btn ghost wide" onClick={loadMore}>
            {pageError ? 'Retry loading plates' : 'Load more plates'}
          </button>
        )}
      </div>}
    </div>
  )
}
