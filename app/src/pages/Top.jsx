import { Link } from '../components/NavLinks'
import { CrownIcon } from '../components/icons'
import { initialsOf } from '../lib/auth'
import { avatarStyle, plural } from '../lib/format'
import { superPercent, totalRatings } from '../lib/food'
import { useQuery } from '../data/useQuery'
import { fetchTop } from '../data/queries'

const MIN_RATINGS = 3 // a dish needs this many ratings to rank

/** Podium, top dishes, top foodies (renderTop() in index.html). */
export default function Top() {
  const { data, error } = useQuery(fetchTop, [])
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
