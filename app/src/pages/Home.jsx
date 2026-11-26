import { Link } from '../components/NavLinks'
import FeedSection from '../components/FeedSection'
import HomeBanner from '../components/HomeBanner'
import { ChevronIcon, FlameIcon } from '../components/icons'
import { useHomeData } from '../data/useHomeData'
import { superPercent, totalRatings } from '../lib/food'
import { plural } from '../lib/format'

export default function Home() {
  const { data } = useHomeData()
  const { canteens, foods, platesToday } = data

  const hot = [...foods].sort((a, b) => totalRatings(b) - totalRatings(a))[0]
  const hotCanteen = hot && totalRatings(hot) > 0 && canteens.find(c => c.id === hot.canteenId)

  return (
    <section className="view" id="v-home">
      <div className="band"><div className="wrap">
        <div className="today">
          <h1>What's on your plate today?</h1>
          {hot && hotCanteen && (
            <Link className="hotbar" to={`/canteens/${hotCanteen.id}`}>
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
        <HomeBanner canteens={canteens} />
        <FeedSection canteens={canteens} />
      </div></div>
    </section>
  )
}
