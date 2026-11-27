import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Link } from './NavLinks'
import Avatar from './Avatar'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { fetchPeople } from '../data/queries'
import { samplePosts } from '../data/feed'
import { useQuery } from '../data/useQuery'
import { queryKey } from '../data/queryCache'

export default function People({ compact = false, searchOnly = false }) {
  const { session } = useAuth()
  const uid = session?.user?.id
  const [term, setTerm] = useState('')
  const [search, setSearch] = useState('')
  const query = term.trim().toLowerCase()
  const limit = compact ? 8 : 24
  useEffect(() => {
    if (compact || query === search) return
    const timer = setTimeout(() => setSearch(query), 250)
    return () => clearTimeout(timer)
  }, [compact, query, search])
  const { data: rows, error } = useQuery(queryKey('people', limit, query), () => {
    if (supabase) return fetchPeople(query, uid, limit)
    const all = new Map(samplePosts().map(p => [p.userId, { id: p.userId, ...p.author }]))
    return [...all.values()].filter(p => p.name.toLowerCase().includes(query))
  }, { enabled: (compact || query === search) && (!searchOnly || !!query) })
  // No filler suggestion card when the only registered account is the viewer.
  if(compact && rows?.length===0 && !error) return null
  return <section className={'people-panel' + (compact ? ' compact' : ' card')}>
    <div className="people-heading"><h3>{compact ? 'Foodies to discover' : 'Find foodies'}</h3>{compact && <Link to="/people">See all</Link>}</div>
    {!compact && <label className="search"><Search size={20}/><input type="search" aria-label="Search students by name" placeholder="Search by name" value={term} onChange={e => setTerm(e.target.value)} /></label>}
    {(!searchOnly || query) && !rows && !error && <p role="status">Finding foodies…</p>}
    {error && <p role="alert">Couldn't load profiles. Try again later.</p>}
    {(!searchOnly || query) && rows?.length === 0 && !error && <p>No matching students yet.</p>}
    <div className="people-list">{rows?.map(p => <Link className="person" key={p.id} to={'/u/' + p.id}>
      <Avatar name={p.name} url={p.avatar}/><span><b>{p.name}</b><small>{[p.faculty,p.batch].filter(Boolean).join(' · ') || 'Mora student'}</small></span><span className="person-visit">View</span>
    </Link>)}</div>
  </section>
}
