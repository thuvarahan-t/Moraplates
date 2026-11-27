import { Link } from '../components/NavLinks'
import FeedSection from '../components/FeedSection'
import HomeBanner from '../components/HomeBanner'
import People from '../components/People'
import { ChevronIcon, FlameIcon } from '../components/icons'
import { useHomeData } from '../data/useHomeData'
import { useAuth } from '../lib/auth'
import { superPercent, totalRatings } from '../lib/food'
import { plural } from '../lib/format'

const colomboHour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', hour: 'numeric', hourCycle: 'h23' })

export default function Home() {
  const { data } = useHomeData()
  const { profile, session } = useAuth()
  const { canteens, foods, platesToday } = data
  const fullName = session && profile?.id !== session.user.id
    ? session.user.user_metadata?.full_name
    : profile?.fullName
  const firstName = typeof fullName === 'string' ? fullName.trim().split(/\s+/, 1)[0] : ''
  const hour = Number(colomboHour.format())
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const hot = [...foods].sort((a, b) => totalRatings(b) - totalRatings(a))[0]
  const hotCanteen = hot && totalRatings(hot) > 0 && canteens.find(c => c.id === hot.canteenId)

  return (
    <section className="view" id="v-home">
      <div className="band"><div className="wrap">
        <div className="today">
          <h1>{firstName ? `${greeting}, ${firstName}` : "What's on your plate today?"}</h1>
          {hot && hotCanteen && (
            <Link className="hotbar" to={`/canteens/${hotCanteen.id}/foods/${hot.id}`}>
              <span className="hi"><FlameIcon /></span>
              <span className="hbt">
                <small>Today's hot plate</small>
                <b>{hot.name} · {hotCanteen.name}</b>
                <span>{plural(platesToday, 'post')} today · {superPercent(hot)}% say Super</span>
              </span>
              <ChevronIcon />
            </Link>
          )}
        </div>
        <div className="social-layout">
          <div>
            <HomeBanner canteens={canteens} />
            <FeedSection canteens={canteens} />
          </div>
          <aside className="social-aside"><People compact /></aside>
        </div>
      </div></div>
    </section>
  )
}
