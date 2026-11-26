import { useState } from 'react'
import { Link } from '../components/NavLinks'
import CountUp from '../components/CountUp'
import Dish from '../components/Dish'
import { CheckIcon, HeartIcon, LockIcon, LogOutIcon, PencilIcon } from '../components/icons'
import { useAuth, initialsOf } from '../lib/auth'
import { badgesFor } from '../lib/badges'
import { useFx } from '../lib/fx'
import { RATING } from '../lib/format'
import { usePost } from '../lib/post'
import { supabase } from '../lib/supabase'
import { useQuery } from '../data/useQuery'
import { fetchProfilePage, friendly, updateProfile } from '../data/queries'

const TONES = { leaf: ['var(--sb)', 'var(--st)'], mus: ['var(--ob)', 'var(--ot)'], tom: ['var(--ab)', 'var(--at)'] }
const LOCK = <LockIcon />

export default function Profile() {
  const { session, profile, ready } = useAuth()

  if (!ready) return <section className="view" />

  if (!supabase || !session) {
    return (
      <section className="view"><div className="band"><div className="wrap narrow">
        <div className="card empty rise">
          <h3>You're browsing as a guest</h3>
          <p>Sign in with your university email to post plates, vote and collect badges.</p>
          <Link className="btn sm" to="/welcome">Sign in</Link>
        </div>
      </div></div></section>
    )
  }
  if (!profile) return <section className="view" />
  return <SignedIn uid={session.user.id} email={session.user.email} profile={profile} />
}

function SignedIn({ uid, email, profile }) {
  const { signOut } = useAuth()
  const { openPost } = usePost()
  const { data } = useQuery(() => fetchProfilePage(uid), [uid])
  // New accounts get the email name ("thuvarahant.23"); nudge them to set a real one.
  const [editing, setEditing] = useState(false)
  const needsName = profile.fullName === email.split('@')[0]

  const s = data?.stats
  const badges = badgesFor(s)
  const sub = [profile.faculty, profile.batch].filter(Boolean).join(' · ') || email

  return (
    <section className="view"><div className="band"><div className="wrap">
      <div className="card pro rise">
        <span className="av">{initialsOf(profile.fullName)}</span>
        <div className="who"><b>{profile.fullName}</b><span style={{ color: 'var(--mut)' }}>{sub}</span></div>
        <div className="pro-acts">
          <button className="btn sm ghost" onClick={() => setEditing(e => !e)}>{editing ? 'Close' : <><PencilIcon />Edit profile</>}</button>
          <button className="btn sm" onClick={() => openPost()}>Post your plate</button>
        </div>
      </div>

      {(editing || needsName) && <EditProfile uid={uid} profile={profile} onDone={() => setEditing(false)} />}

      <div className="stats rise" style={{ '--i': 1 }}>
        <div><CountUp to={s?.plates ?? 0} /><span>plates posted</span></div>
        <div><CountUp to={s?.canteens_tried ?? 0} /><span>canteens tried</span></div>
        <div><CountUp to={s?.likes_received ?? 0} /><span>likes received</span></div>
        <div><CountUp to={s?.super_given ?? 0} /><span>Super ratings given</span></div>
      </div>

      {data?.favCanteen ? (
        <Link className="card ccard rise tilt" to={`/canteens/${data.favCanteen.id}`} style={{ '--i': 2, boxShadow: 'inset 0 0 0 2px var(--leaf)' }}>
          <span className="rank" style={{ background: 'var(--sb)', color: 'var(--st)' }}><HeartIcon /></span>
          <div className="cb"><small>Your vote this week</small><span className="cn">{data.favCanteen.name}</span></div>
          <span style={{ fontWeight: 700, alignSelf: 'center' }}>Change</span>
        </Link>
      ) : (
        <Link className="card ccard rise tilt" to="/canteens" style={{ '--i': 2 }}>
          <span className="rank"><HeartIcon /></span>
          <div className="cb"><span className="cn">Pick your favourite canteen</span><small>You haven't voted this week. Open a canteen and tap Vote.</small></div>
        </Link>
      )}

      <h3 className="sec">Badges</h3>
      <div className="badges">
        {badges.map((b, i) => {
          const [bg, fg] = b.earned ? TONES[b.tone] : ['var(--chip)', 'var(--mut)']
          return (
            <div key={b.id} className={'card bdg rise' + (b.earned ? '' : ' lock')} style={{ '--i': i }}>
              <span className="si" style={{ background: bg, color: fg }}>{b.earned ? <CheckIcon /> : LOCK}</span>
              <div><b>{b.name}</b><small>{b.earned ? b.how : `${b.how} · ${b.have}/${b.goal}`}</small></div>
            </div>
          )
        })}
      </div>

      <h3 className="sec">Your plates</h3>
      <div className="mine">
        {data?.posts.map((p, i) => {
          const [rl, rc] = RATING[p.rating]
          return (
            <Link key={p.id} className="card rise tilt" to={`/canteens/${p.canteenId}`} style={{ '--i': i, textDecoration: 'none', color: 'inherit' }}>
              {p.photo ? <img className="sq" src={p.photo} alt={p.food.name} loading="lazy" /> : <Dish name={p.food.name} />}
              <div className="mb"><span>{p.food.name}</span><span className={'rt ' + rc}>{rl}</span></div>
            </Link>
          )
        })}
      </div>
      {data && !data.posts.length && <p style={{ color: 'var(--mut)' }}>No plates yet. Tap + to post your first one.</p>}

      <button className="btn ghost sm signout" onClick={signOut}><LogOutIcon />Sign out</button>
    </div></div></section>
  )
}

function EditProfile({ uid, profile, onDone }) {
  const { refreshProfile } = useAuth()
  const { toast } = useFx()
  const [f, setF] = useState({ fullName: profile.fullName, faculty: profile.faculty ?? '', batch: profile.batch ?? '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = k => e => { setF(v => ({ ...v, [k]: e.target.value })); setErr('') }

  const save = async e => {
    e.preventDefault()
    if (!f.fullName.trim()) return setErr('Enter your name.')
    setBusy(true)
    try {
      await updateProfile(uid, { fullName: f.fullName.trim(), faculty: f.faculty.trim(), batch: f.batch.trim() })
      refreshProfile()
      toast('Profile saved')
      onDone()
    } catch (e2) {
      setErr(friendly(e2))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card addf rise" noValidate onSubmit={save} style={{ marginTop: 0, marginBottom: 16, background: 'var(--card)' }}>
      <b>Tell others who's posting</b>
      <div className="afr">
        <label className="fl"><span>Name</span><input maxLength={60} placeholder="Thuvarahan T" value={f.fullName} onChange={set('fullName')} /></label>
        <label className="fl"><span>Faculty</span><input maxLength={60} placeholder="IT" value={f.faculty} onChange={set('faculty')} /></label>
        <label className="fl" style={{ flex: '0 1 130px' }}><span>Batch</span><input maxLength={20} placeholder="23" value={f.batch} onChange={set('batch')} /></label>
        <button className="btn sm" disabled={busy}>Save</button>
      </div>
      <p className="err" role="alert">{err}</p>
    </form>
  )
}
