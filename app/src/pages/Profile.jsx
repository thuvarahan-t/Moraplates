import { useEffect, useState } from 'react'
import People from '../components/People'
import { exportPhoto } from '../lib/photoEdit'
import { checkAdmin } from '../data/admin'
import { samplePosts } from '../data/feed'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Link } from '../components/NavLinks'
import Avatar from '../components/Avatar'
import Loader from '../components/Loader'
import CountUp from '../components/CountUp'
import Dish from '../components/Dish'
import { BackIcon, CameraIcon, CheckIcon, HeartIcon, LockIcon, LogOutIcon, PencilIcon } from '../components/icons'
import { useAuth } from '../lib/auth'
import { badgesFor } from '../lib/badges'
import { useFx } from '../lib/fx'
import { RATING } from '../lib/format'
import { usePost } from '../lib/post'
import { supabase } from '../lib/supabase'
import { useQuery } from '../data/useQuery'
import { queryKey } from '../data/queryCache'
import { fetchPosts, fetchProfilePage, fetchPublicProfile, friendly, updateAvatar, updateProfile } from '../data/queries'
import { InstallButton } from '../components/InstallPrompt'

const TONES = { leaf: ['var(--sb)', 'var(--st)'], mus: ['var(--ob)', 'var(--ot)'], tom: ['var(--ab)', 'var(--at)'] }

/** /profile: the signed-in student's own profile. */
export default function Profile() {
  const { session, profile, ready } = useAuth()
  const { cache } = usePost()
  const uid = session?.user?.id
  const details = useQuery('own-profile', () => fetchProfilePage(uid, cache), { enabled: !!supabase && !!uid })

  if (!ready) return <section className="view" />
  if (!supabase || !session) {
    return (
      <section className="view"><div className="band"><div className="wrap narrow">
        <People searchOnly />
        <div className="card empty rise">
          <h3>You're browsing as a guest</h3>
          <p>Sign in with your university email to post plates, vote and collect badges.</p>
          <Link className="btn sm" to="/welcome">Sign in</Link>
        </div>
      </div></div></section>
    )
  }
  if (profile?.id !== uid) return <section className="view" />
  return <OwnProfile uid={uid} email={session.user.email} profile={profile} details={details} />
}

/** /u/:id: anyone's public profile, opened by tapping a name or photo on a post. */
export function UserProfile() {
  const { id } = useParams()
  const { session } = useAuth()
  const uid = session?.user?.id
  const { data, error, loading } = useQuery(queryKey('public-profile', id), () => supabase ? fetchPublicProfile(id, uid) : Promise.resolve((() => { const posts=samplePosts().filter(p=>p.userId===id); const a=posts[0]?.author; return a ? {profile:{id,fullName:a.name,faculty:a.faculty},stats:{plates:posts.length},posts} : null })()), { enabled: id !== uid })

  if (uid && id === uid) return <Navigate to="/profile" replace />
  if (loading && !data) return <section className="view"><Loader label="Loading profile" /></section>
  if (error || !data) {
    return (
      <section className="view"><div className="band"><div className="wrap narrow">
        <div className="card empty"><h3>{error ? "Couldn't load this profile" : 'Student not found'}</h3><p>{error ? 'Check your connection and try again.' : 'They may have deleted their account.'}</p></div>
      </div></div></section>
    )
  }
  const p = data.profile
  return (
    <ProfileBody
      top={<Link className="back" to="/people"><BackIcon />Find foodies</Link>}
      authorId={id}
      viewerId={uid}
      head={<>
        <Avatar name={p.fullName} url={p.avatar} />
        <div className="who"><b>{p.fullName}</b><span style={{ color: 'var(--mut)' }}>{[p.faculty, p.batch].filter(Boolean).join(' · ') || 'Mora student'}</span></div>
      </>}
      stats={data.stats}
      posts={data.posts}
      platesTitle={`${p.fullName.split(' ')[0]}'s plates`}
      emptyPlates="No plates yet."
    />
  )
}

function OwnProfile({ uid, email, profile, details }) {
  const { signOut, refreshProfile } = useAuth()
  const { data: showAdmin } = useQuery('admin-link', () => checkAdmin().catch(() => false))
  const { openPost, invalidate } = usePost()
  const { toast } = useFx()
  const navigate = useNavigate()
  const leave = async () => {
    await signOut()
    toast('Signed out. See you at lunch!')
    navigate('/welcome')
  }
  const { data, error, reload } = details
  const [editing, setEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  // New accounts start with the email name ("thuvarahant.23"); nudge them to set a real one.
  const needsName = profile.fullName === email.split('@')[0]
  const sub = [profile.faculty, profile.batch].filter(Boolean).join(' · ') || email

  const pickAvatar = async picked => {
    if (!picked) return
    setUploading(true)
    try {
      const file = await exportPhoto(picked, { fixedAspect: 1, max: 600 })
      await updateAvatar(uid, file, profile.avatarPath)
      refreshProfile()
      invalidate()
      toast('Profile photo updated')
    } catch (err) {
      toast(friendly(err))
    } finally {
      setUploading(false)
    }
  }

  if (error) return <section className="view"><div className="card empty"><h3>Couldn't load your profile</h3><button className="btn sm" onClick={reload}>Retry</button></div></section>
  if (!data) return <section className="view"><Loader label="Loading your profile" /></section>
  return (
    <ProfileBody
      head={<>
        <label className={'avpick' + (uploading ? ' busy' : '')} title="Change profile photo">
          <Avatar name={profile.fullName} url={profile.avatar} />
          <span className="avcam" aria-hidden="true"><CameraIcon size={16} /></span>
          <input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)pickAvatar(f)}} disabled={uploading} aria-label="Change profile photo" hidden />
        </label>
        <div className="who"><b>{profile.fullName}</b><span style={{ color: 'var(--mut)' }}>{uploading ? 'Uploading photo…' : sub}</span></div>
        <div className="pro-acts">
          <button className="btn sm ghost" onClick={() => setEditing(v => !v)}>{editing ? 'Close' : <><PencilIcon />Edit profile</>}</button>
          <button className="btn sm" onClick={() => openPost()}>Post your plate</button>
        </div>
      </>}
      below={<>{(editing || needsName) && <EditProfile uid={uid} profile={profile} onDone={() => setEditing(false)} />}</>}
      extra={data?.favCanteen ? (
        <Link className="card ccard rise tilt" to={`/canteens/${data.favCanteen.id}`} style={{ '--i': 2, boxShadow: 'inset 0 0 0 2px var(--leaf)' }}>
          <span className="rank" style={{ background: 'var(--sb)', color: 'var(--st)' }}><HeartIcon /></span>
          <div className="cb"><small>Your vote this week</small><span className="cn">{data.favCanteen.name}</span></div>
          <span style={{ fontWeight: 700, alignSelf: 'center' }}>Change</span>
        </Link>
      ) : data && (
        <Link className="card ccard rise tilt" to="/top" style={{ '--i': 2 }}>
          <span className="rank"><HeartIcon /></span>
          <div className="cb"><span className="cn">Pick your favourite canteen</span><small>You haven't voted this week. Tap to vote.</small></div>
        </Link>
      )}
      stats={data?.stats}
      authorId={uid}
      viewerId={uid}
      posts={data?.posts}
      platesTitle="Your plates"
      emptyPlates="No plates yet. Tap + to post your first one."
      after={<div className="cacts">{showAdmin === true && <Link className="btn sm" to="/admin">Admin console</Link>}<InstallButton/><button className="btn ghost sm signout" onClick={leave}><LogOutIcon />Sign out</button></div>}
    />
  )
}

/** Layout shared by your own profile and other students' profiles. */
function ProfileBody({ top, head, below, extra, stats: s, posts, authorId, viewerId, platesTitle, emptyPlates, after }) {
  const badges = badgesFor(s)
  const {toast}=useFx()
  const [older,setOlder]=useState([])
  const [hasMore,setHasMore]=useState(false)
  const [busy,setBusy]=useState(false)
  useEffect(()=>{setOlder([]);setHasMore(!!supabase&&posts?.length===60)},[posts])
  const all=[...(posts??[]),...older]
  const loadOlder=async()=>{
    if(busy||!hasMore||!all.length)return
    setBusy(true)
    try{const rows=await fetchPosts(viewerId,{authorId,before:all.at(-1),limit:60});setOlder(old=>[...old,...rows.filter(r=>!all.some(p=>p.id===r.id))]);setHasMore(rows.length===60)}catch(e){toast(friendly(e))}finally{setBusy(false)}
  }
  return (
    <section className="view"><div className="band"><div className="wrap">
      {top}
      <People searchOnly />
      <div className="card pro rise">{head}</div>
      {below}

      <div className="stats rise" style={{ '--i': 1 }}>
        <div><CountUp to={s?.plates ?? 0} /><span>plates posted</span></div>
        <div><CountUp to={s?.canteens_tried ?? 0} /><span>canteens tried</span></div>
        <div><CountUp to={s?.likes_received ?? 0} /><span>likes received</span></div>
        <div><CountUp to={s?.super_given ?? 0} /><span>Super ratings given</span></div>
      </div>

      {extra}

      <h3 className="sec">Badges</h3>
      <div className="badges">
        {badges.map((b, i) => {
          const [bg, fg] = b.earned ? TONES[b.tone] : ['var(--chip)', 'var(--mut)']
          return (
            <div key={b.id} className={'card bdg rise' + (b.earned ? '' : ' lock')} style={{ '--i': i }}>
              <span className="si" style={{ background: bg, color: fg }}>{b.earned ? <CheckIcon /> : <LockIcon />}</span>
              <div><b>{b.name}</b><small>{b.earned ? b.how : `${b.how} · ${b.have}/${b.goal}`}</small></div>
            </div>
          )
        })}
      </div>

      <h3 className="sec">{platesTitle}</h3>
      <div className="mine">
        {all.map((p, i) => {
          const [rl, rc] = RATING[p.rating]
          return (
            <Link key={p.id} className="card rise tilt" to={`/posts/${p.id}`} style={{ '--i': i, textDecoration: 'none', color: 'inherit' }}>
              {p.photo ? <img className="sq" src={p.photo} alt={p.food.name} loading="lazy" /> : <Dish name={p.food.name} />}
              <div className="mb"><span>{p.food.name}</span><span className={'rt ' + rc}>{rl}</span></div>
            </Link>
          )
        })}
      </div>
      {hasMore&&<button className="btn ghost wide" onClick={loadOlder} disabled={busy}>{busy?'Loading…':'Load older plates'}</button>}
      {posts && !posts.length && <p style={{ color: 'var(--mut)' }}>{emptyPlates}</p>}
      {after}
    </div></div></section>
  )
}

function EditProfile({ uid, profile, onDone }) {
  const { refreshProfile } = useAuth()
  const { invalidate } = usePost()
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
      invalidate()
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
