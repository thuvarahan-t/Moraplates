import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Link } from './NavLinks'
import Avatar from './Avatar'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { fetchPeople } from '../data/queries'
import { samplePosts } from '../data/feed'

export default function People({ compact = false, searchOnly = false }) {
  const { session } = useAuth()
  const uid = session?.user?.id
  const [term, setTerm] = useState('')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let live = true
    if(searchOnly&&!term.trim()){setRows([]);setError(false);return}
    setRows(null); setError(false)
    const timer = setTimeout(async () => {
      try {
        const all = [...new Map(samplePosts().map(p => [p.userId, { id:p.userId, ...p.author }])).values()]
        const result = supabase ? await fetchPeople(term, uid, compact ? 8 : 24) : all.filter(p => p.name.toLowerCase().includes(term.trim().toLowerCase()))
        if (live) setRows(result)
      } catch { if (live) { setError(true); setRows([]) } }
    }, compact ? 0 : 250)
    return () => { live = false; clearTimeout(timer) }
  }, [term, uid, compact, searchOnly])
  return <section className={'people-panel' + (compact ? ' compact' : ' card')}>
    <div className="people-heading"><h3>{compact ? 'Foodies to discover' : 'Find foodies'}</h3>{compact && <Link to="/people">See all</Link>}</div>
    {!compact && <label className="search"><Search size={20}/><input type="search" aria-label="Search students by name" placeholder="Search by name" value={term} onChange={e => setTerm(e.target.value)} /></label>}
    {(!searchOnly||term.trim()) && rows === null && <p role="status">Finding foodies…</p>}
    {error && <p role="alert">Couldn't load profiles. Try again later.</p>}
    {(!searchOnly||term.trim()) && rows?.length === 0 && !error && <p>No matching students yet.</p>}
    <div className="people-list">{rows?.map(p => <Link className="person" key={p.id} to={'/u/' + p.id}>
      <Avatar name={p.name} url={p.avatar}/><span><b>{p.name}</b><small>{[p.faculty,p.batch].filter(Boolean).join(' · ') || 'Mora student'}</small></span><span className="person-visit">View</span>
    </Link>)}</div>
  </section>
}
