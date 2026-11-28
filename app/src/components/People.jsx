import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Link } from './NavLinks'
import Avatar from './Avatar'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { fetchPeople, fetchPeoplePage } from '../data/queries'
import { samplePosts } from '../data/feed'
import { useQuery } from '../data/useQuery'
import { queryKey } from '../data/queryCache'

const DIRECTORY_PAGE_SIZE = 30

export default function People({ compact = false, searchOnly = false }) {
  const { session } = useAuth()
  const uid = session?.user?.id
  const [term, setTerm] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const heading = useRef(null)
  const query = term.trim().toLowerCase()
  const paginated = !compact && !searchOnly
  const limit = compact ? 8 : paginated ? DIRECTORY_PAGE_SIZE : 24
  useEffect(() => {
    if (compact || query === search) return
    const timer = setTimeout(() => {
      setSearch(query)
      setPage(0)
    }, 250)
    return () => clearTimeout(timer)
  }, [compact, query, search])
  const { data, loading, error, reload } = useQuery(queryKey('people', limit, query, page), async () => {
    if (supabase) {
      if (paginated) return fetchPeoplePage(query, uid, page, limit)
      return { rows: await fetchPeople(query, uid, limit) }
    }
    const all = new Map(samplePosts().map(p => [p.userId, { id: p.userId, ...p.author }]))
    const matches = [...all.values()].filter(p => p.name.toLowerCase().includes(query))
    return { rows: matches.slice(page * limit, (page + 1) * limit), total: matches.length }
  }, { enabled: (compact || query === search) && (!searchOnly || !!query) })
  const rows = data?.rows
  const pageCount = Math.ceil((data?.total ?? 0) / limit)

  function showPage(next) {
    setPage(next)
    window.scrollTo(0, 0)
    heading.current?.focus({ preventScroll: true })
  }

  // No filler suggestion card when the only registered account is the viewer.
  if(compact && rows?.length===0 && !error) return null
  return <section className={'people-panel' + (compact ? ' compact' : ' card')}>
    <div className="people-heading"><h3 ref={heading} tabIndex={paginated ? -1 : undefined}>{compact ? 'Foodies to discover' : 'Find foodies'}</h3>{compact && <Link to="/people">See all</Link>}</div>
    {!compact && <label className="search"><Search size={20}/><input type="search" aria-label="Search students by name" placeholder="Search by name" value={term} onChange={e => setTerm(e.target.value)} /></label>}
    {(!searchOnly || query) && !rows && !error && <p role="status">Finding foodies…</p>}
    {error && (paginated ? (
      <div className="people-load-error"><p role="alert">Couldn't load profiles.</p><button className="btn sm ghost" type="button" onClick={reload}>Retry</button></div>
    ) : <p role="alert">Couldn't load profiles. Try again later.</p>)}
    {(!searchOnly || query) && rows?.length === 0 && !error && <p>No matching students yet.</p>}
    <div className="people-list">{rows?.map(p => <Link className="person" key={p.id} to={'/u/' + p.id}>
      <Avatar name={p.name} url={p.avatar}/><span><b>{p.name}</b><small>{[p.faculty,p.batch].filter(Boolean).join(' · ') || 'Mora student'}</small></span><span className="person-visit">View</span>
    </Link>)}</div>
    {paginated && (page > 0 || pageCount > 1) && (
      <nav className="people-pagination" aria-label="Foodies pages">
        <button type="button" className="btn sm ghost" aria-label="Previous page" disabled={page === 0 || query !== search}
          onClick={() => showPage(page - 1)}>Previous</button>
        <span role="status" aria-atomic="true">Page {page + 1}{pageCount > 0 && ` of ${pageCount}`}</span>
        <button type="button" className="btn sm ghost" aria-label="Next page" disabled={loading || page + 1 >= pageCount}
          onClick={() => showPage(page + 1)}>Next</button>
      </nav>
    )}
  </section>
}
