import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Link } from '../components/NavLinks'
import PostCard from '../components/PostCard'
import Loader from '../components/Loader'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { fetchPosts } from '../data/queries'
import { useQuery } from '../data/useQuery'
import { queryKey } from '../data/queryCache'
import { samplePosts, useLikeToggle } from '../data/feed'
import { useHomeData } from '../data/useHomeData'
export default function PostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const commentId = search.get('comment')
  const { session } = useAuth()
  const uid = session?.user?.id
  const { data, loading, error, reload } = useQuery(queryKey('post', id), () => supabase ? fetchPosts(uid,{postId:id,limit:1}) : Promise.resolve(samplePosts().filter(p => p.id === id)))
  const { data: home } = useHomeData()
  const [posts,setPosts] = useState(() => data ?? [])
  const ref = useRef(posts); ref.current = posts
  useEffect(() => setPosts(data || []),[data])
  const like = useLikeToggle(ref,setPosts)
  function closeLinkedComment() {
    setSearch(current => {
      const next = new URLSearchParams(current)
      next.delete('comment')
      return next
    }, { replace: true, preventScrollReset: true })
  }

  return <section className="view"><div className="band"><div className="wrap narrow">
    <Link className="back" to="/">Back to feed</Link>
    {loading && !data ? <Loader label="Loading plate"/> : error ? <div className="card empty"><h3>Couldn't load this plate</h3><button className="btn sm" onClick={reload}>Retry</button></div> : posts.length ? <PostCard key={posts[0].id} post={posts[0]} canteen={home.canteens.find(c=>c.id===posts[0].canteenId)} onLike={like} onDeleted={()=>navigate('/', { replace: true })}
      commentId={posts[0].id === id ? commentId : undefined} onCloseLinkedComment={closeLinkedComment}/> : <div className="card empty"><h3>Plate unavailable</h3><p>It may have been deleted.</p></div>}
  </div></div></section>
}
