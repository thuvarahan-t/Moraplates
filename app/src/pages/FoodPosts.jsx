import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import EditFoodButton from '../components/EditFoodButton'
import { BackIcon, TrashIcon } from '../components/icons'
import Loader from '../components/Loader'
import { Link } from '../components/NavLinks'
import PostCard from '../components/PostCard'
import { samplePosts, useLikeToggle } from '../data/feed'
import { queryKey } from '../data/queryCache'
import { fetchFoodPageDetails, fetchPosts } from '../data/queries'
import { SAMPLE_CANTEENS, SAMPLE_FOODS } from '../data/sample'
import { useQuery } from '../data/useQuery'
import { useAuth } from '../lib/auth'
import { usePost } from '../lib/post'
import { supabase } from '../lib/supabase'
import { useCanteenRemoval } from '../lib/useCanteenRemoval'

const PAGE_SIZE = 20

export default function FoodPosts() {
  const { id, foodId } = useParams()
  const { data, loading, error, reload } = useQuery(queryKey('food-details', id, foodId), async () => {
    if (supabase) return fetchFoodPageDetails(id, foodId)
    const canteen = SAMPLE_CANTEENS.find(c => c.id === id)
    const food = SAMPLE_FOODS.find(f => f.id === foodId && f.canteenId === id)
    return canteen && food ? { canteen, food } : null
  })
  const canteen = data?.canteen
  const back = <Link className="back" to={canteen ? `/canteens/${id}` : '/canteens'}><BackIcon />{canteen?.name ?? 'All canteens'}</Link>
  let content
  if (loading) content = <Loader label="Loading food" />
  else if (error) content = <div className="card empty"><h3>Couldn't load this food</h3><button type="button" className="btn sm" onClick={reload}>Retry</button></div>
  else if (data) content = <FoodPlateList canteen={canteen} food={data.food} />
  else content = <div className="card empty"><h3>Food not found</h3></div>

  return (
    <section className="view"><div className="band"><div className="wrap narrow">
      {back}
      {content}
    </div></div></section>
  )
}

function FoodPlateList({ canteen, food }) {
  const { openPost, cache } = usePost()
  const { session } = useAuth()
  const removal = useCanteenRemoval()
  const opts = { canteenId: canteen.id, foodId: food.id, limit: PAGE_SIZE }
  const fetchPage = before => supabase
    ? fetchPosts(session?.user.id, { ...opts, before })
    : Promise.resolve(samplePosts().filter(post => post.foodId === food.id && post.canteenId === canteen.id))
  const key = queryKey('food-posts', canteen.id, food.id)
  const { data, loading, error, reload } = useQuery(key, () => fetchPage())
  const [state, setState] = useState(null)
  const [pageRequest, setPageRequest] = useState(null)
  const loadingMore = pageRequest?.source === data && pageRequest?.status === 'loading'
  const pageError = pageRequest?.source === data && pageRequest?.status === 'error'
  const current = state?.source === data ? state : null
  const posts = current?.posts ?? data ?? []
  const cursor = current ? current.cursor : data?.length === PAGE_SIZE ? data.at(-1) : null
  const postsRef = useRef(posts)
  postsRef.current = posts
  const active = useRef(null)
  useEffect(() => {
    active.current = data
    return () => { active.current = null }
  }, [data])
  const toggleLike = useLikeToggle(postsRef, update => setState(previous => {
    if (active.current !== data) return previous
    const samePage = previous?.source === data
    return { source: data, posts: update(samePage ? previous.posts : data), cursor: samePage ? previous.cursor : cursor }
  }))

  async function loadMore() {
    if (!cursor || loadingMore) return
    setPageRequest({ source: data, status: 'loading' })
    try {
      const rows = await cache.load(queryKey('food-posts', canteen.id, food.id, cursor.id), () => fetchPage(cursor))
      if (active.current !== data) return
      setState(previous => {
        const existing = previous?.source === data ? previous.posts : data
        return { source: data, posts: [...existing, ...rows], cursor: rows.length === PAGE_SIZE ? rows.at(-1) : null }
      })
      setPageRequest(null)
    } catch {
      if (active.current === data) setPageRequest({ source: data, status: 'error' })
    }
  }

  return (
    <>
      <div className="vh food-plates-heading">
        <div><h1>{food.name}</h1><p>Rs {food.price} · Plates from {canteen.name}</p></div>
        <div className="food-page-actions">
          <EditFoodButton food={food} />
          <button type="button" className="btn sm" onClick={() => openPost(canteen.id, food.id)}>Post this plate</button>
        </div>
      </div>
      {removal.allowed && food.photoPath && food.photo && (
        <div className="card food-moderation-photo">
          <img src={food.photo} alt={`Menu photo for ${food.name}`} />
          <button type="button" className="mini canteen-delete-action" disabled={removal.busy}
            onClick={() => removal.remove('food_photos', food.id, {
              confirmation: `Delete the menu photo for ${food.name}?`,
              success: 'Menu photo deleted',
              photoPath: food.photoPath,
            })}><TrashIcon size={18} />Delete menu photo</button>
        </div>
      )}
      {loading && <Loader label="Loading plates" />}
      {error && <div className="card empty"><h3>Couldn't load plates</h3><button type="button" className="btn sm" onClick={reload}>Retry</button></div>}
      {data && !posts.length && <div className="card empty"><h3>No plates yet</h3><p>Post the first plate of {food.name}.</p></div>}
      <div className="posts">{posts.map((post, index) => <PostCard key={post.id} post={post} canteen={canteen} index={index} onLike={toggleLike} />)}</div>
      {cursor && <button type="button" className="btn ghost wide" onClick={loadMore} disabled={loadingMore}>
        {loadingMore ? 'Loading plates…' : pageError ? 'Retry loading plates' : 'Load more plates'}
      </button>}
    </>
  )
}
