import { useState } from 'react'
import { Link } from '../components/NavLinks'
import CanteenThumb, { firstPhotoByCanteen } from '../components/CanteenThumb'
import { CheckIcon, CrownIcon, HeartIcon } from '../components/icons'
import { initialsOf, useAuth } from '../lib/auth'
import { avatarStyle, plural } from '../lib/format'
import { superPercent, totalRatings } from '../lib/food'
import { centreOf, useFx } from '../lib/fx'
import { useSignInGate } from '../lib/useSignInGate'
import { useQuery } from '../data/useQuery'
import { castVote, fetchTop, friendly, removeVote } from '../data/queries'

const MIN_RATINGS = 3 // a dish needs this many ratings to rank

/** Podium, top dishes, top foodies (renderTop() in index.html). */
export default function Top() {
  const { session } = useAuth()
  const uid = session?.user?.id
  const { data, error, reload } = useQuery(() => fetchTop(uid), [uid])
  const canteens = data?.canteens ?? []
  const dishes = (data?.foods ?? []).filter(f => totalRatings(f) >= MIN_RATINGS)
    .sort((a, b) => superPercent(b) - superPercent(a) || totalRatings(b) - totalRatings(a)).slice(0, 5)
  const nameOf = id => canteens.find(c => c.id === id)?.name ?? ''

  // Podium order: 2nd, 1st, 3rd
  const podium = [[canteens[1], 2, 150, '.25s'], [canteens[0], 1, 210, '0s'], [canteens[2], 3, 110, '.4s']].filter(([c]) => c)

  return (
    <section className="view"><div className="band"><div className="wrap">
      <div className="vh"><div><h2>Top this week</h2><p>Votes reset every Monday at 8am.</p></div></div>
      {error && <div className="card empty"><h3>Couldn't load the rankings</h3><p>Check your connection and try again.</p></div>}
      {data && <VoteBoard canteens={canteens} myVote={data.myVote} photos={data.photos} onVoted={reload} />}

      <div className="podium">
        {podium.map(([c, n, h, d]) => (
          <Link key={c.id} className="pod" to={`/canteens/${c.id}`} style={{ '--cc': c.colour, '--h': h + 'px', '--d': d }}>
            {n === 1 && <CrownIcon className="crown" />}
            <span className="pn">{c.name}</span><span className="pv">{plural(c.votes, 'vote')}</span>
            <div className="blk">{n}</div>
          </Link>
        ))}
      </div>

      <div className="two">
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 18px 4px' }}><h3>Top dishes</h3></div>
          {dishes.map((f, i) => (
            <Link key={f.id} className="rk rise" to={`/canteens/${f.canteenId}`} style={{ '--i': i, textDecoration: 'none', color: 'inherit' }}>
              <span className="n">{i + 1}</span>
              <div className="mi">
                <b>{f.name}</b><small>{nameOf(f.canteenId)} · Rs {f.price}</small>
                <div className="bar" style={{ maxWidth: 260 }}><i style={{ '--w': superPercent(f) + '%', '--cc': 'var(--leaf)' }} /></div>
              </div>
              <span className="rt sup">{superPercent(f)}% Super</span>
            </Link>
          ))}
          {data && !dishes.length && <p className="rk" style={{ color: 'var(--mut)' }}>Dishes show up here once they have {MIN_RATINGS} ratings.</p>}
        </div>
        <div>
          <h3 style={{ marginBottom: 12 }}>Top foodies</h3>
          <div className="foodies">
            {data?.foodies.map((p, i) => (
              <div key={p.user_id} className="card fd rise tilt" style={{ '--i': i }}>
                <span className="av" style={avatarStyle(p.full_name)}>{initialsOf(p.full_name)}</span>
                <b>{p.full_name}</b><small>{plural(p.plates, 'plate')}</small>
              </div>
            ))}
          </div>
          {data && !data.foodies.length && <p style={{ color: 'var(--mut)' }}>Post a plate to get on the board.</p>}
        </div>
      </div>
    </div></div></section>
  )
}

/** One-tap voting for any canteen. Tapping your current vote takes it back. */
function VoteBoard({ canteens, myVote, photos, onVoted }) {
  const { toast, confetti } = useFx()
  const gate = useSignInGate()
  const [busy, setBusy] = useState(null)
  const thumbs = firstPhotoByCanteen(photos)
  const list = [...canteens].sort((a, b) => a.name.localeCompare(b.name)) // stable order while votes move

  const vote = async (c, e) => {
    if (busy || !gate('to vote')) return
    const btn = e.currentTarget
    setBusy(c.id)
    try {
      if (myVote === c.id) {
        await removeVote()
        toast('Vote removed')
      } else {
        await castVote(c.id)
        const [x, y] = centreOf(btn)
        confetti(x, y, 20)
        toast('You voted for ' + c.name)
      }
      onVoted()
    } catch (err) {
      toast(friendly(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="card vboard rise">
      <div className="mh"><h3>Vote your favourite</h3><span>One vote a week · tap again to take it back</span></div>
      <div className="vlist">
        {list.map(c => {
          const mine = myVote === c.id
          return (
            <div key={c.id} className={'vrow' + (mine ? ' mine' : '')}>
              <Link to={`/canteens/${c.id}`} className="vlink">
                <CanteenThumb canteen={c} photo={thumbs[c.id]} size={52} />
                <span className="vi"><b>{c.name}</b><small>{plural(c.votes, 'vote')} this week</small></span>
              </Link>
              <button className={'btn sm' + (mine ? ' voted' : '')} aria-pressed={mine} disabled={busy === c.id} onClick={e => vote(c, e)}>
                {mine ? <><CheckIcon />Voted</> : <><HeartIcon />Vote</>}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
