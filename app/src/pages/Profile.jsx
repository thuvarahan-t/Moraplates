import { useState } from 'react'
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
import { fetchProfilePage, fetchPublicProfile, friendly, updateAvatar, updateProfile } from '../data/queries'

const TONES = { leaf: ['var(--sb)', 'var(--st)'], mus: ['var(--ob)', 'var(--ot)'], tom: ['var(--ab)', 'var(--at)'] }

/** /profile: the signed-in student's own profile. */
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
  return <OwnProfile uid={session.user.id} email={session.user.email} profile={profile} />
}

/** /u/:id: anyone's public profile, opened by tapping a name or photo on a post. */
export function UserProfile() {
  const { id } = useParams()
  const { session } = useAuth()
  const uid = session?.user?.id
  const { data, error, loading } = useQuery(() => fetchPublicProfile(id, uid), [id, uid])

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
      top={<button className="back linkish" onClick={() => history.back()}><BackIcon />Back</button>}
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

function OwnProfile({ uid, email, profile }) {
  const { signOut, refreshProfile } = useAuth()
  const { openPost } = usePost()
  const { toast } = useFx()
  const navigate = useNavigate()
  const leave = async () => {
    await signOut()
    toast('Signed out. See you at lunch!')
    navigate('/welcome')
  }
  const { data } = useQuery(() => fetchProfilePage(uid), [uid])
  const [editing, setEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  // New accounts start with the email name ("thuvarahant.23"); nudge them to set a real one.
  const needsName = profile.fullName === email.split('@')[0]
  const sub = [profile.faculty, profile.batch].filter(Boolean).join(' · ') || email

  const pickAvatar = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      await updateAvatar(uid, file, profile.avatarPath)
      refreshProfile()
      toast('Profile photo updated')
    } catch (err) {
      toast(friendly(err))
    } finally {
      setUploading(false)
    }
  }

  if (!data) return <section className="view"><Loader label="Loading your profile" /></section>
  return (
    <ProfileBody
      head={<>
        <label className={'avpick' + (uploading ? ' busy' : '')} title="Change profile photo">
          <Avatar name={profile.fullName} url={profile.avatar} />
          <span className="avcam" aria-hidden="true"><CameraIcon size={16} /></span>
          <input type="file" accept="image/*" onChange={pickAvatar} disabled={uploading} aria-label="Change profile photo" hidden />
        </label>
        <div className="who"><b>{profile.fullName}</b><span style={{ color: 'var(--mut)' }}>{uploading ? 'Uploading photo…' : sub}</span></div>
        <div className="pro-acts">
          <button className="btn sm ghost" onClick={() => setEditing(v => !v)}>{editing ? 'Close' : <><PencilIcon />Edit profile</>}</button>
          <button className="btn sm" onClick={() => openPost()}>Post your plate</button>
        </div>
      </>}
      below={(editing || needsName) && <EditProfile uid={uid} profile={profile} onDone={() => setEditing(false)} />}
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
      posts={data?.posts}
      platesTitle="Your plates"
      emptyPlates="No plates yet. Tap + to post your first one."
      after={<button className="btn ghost sm signout" onClick={leave}><LogOutIcon />Sign out</button>}
    />
  )
}

/** Layout shared by your own profile and other students' profiles. */
function ProfileBody({ top, head, below, extra, stats: s, posts, platesTitle, emptyPlates, after }) {
  const badges = badgesFor(s)
  return (
    <section className="view"><div className="band"><div className="wrap">
      {top}
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
        {posts?.map((p, i) => {
          const [rl, rc] = RATING[p.rating]
          return (
            <Link key={p.id} className="card rise tilt" to={`/canteens/${p.canteenId}`} style={{ '--i': i, textDecoration: 'none', color: 'inherit' }}>
              {p.photo ? <img className="sq" src={p.photo} alt={p.food.name} loading="lazy" /> : <Dish name={p.food.name} />}
              <div className="mb"><span>{p.food.name}</span><span className={'rt ' + rc}>{rl}</span></div>
            </Link>
          )
        })}
      </div>
      {posts && !posts.length && <p style={{ color: 'var(--mut)' }}>{emptyPlates}</p>}
      {after}
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
