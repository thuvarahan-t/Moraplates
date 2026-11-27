import { NavLink } from 'react-router'
import { FeedIcon, PlusIcon, StoreIcon, TrophyIcon, UserIcon } from './icons'
import { usePost } from '../lib/post'

/** The phone tab bar stays live while the router switches pages. */
export default function BottomNav() {
  const { openPost } = usePost()

  return (
    <nav className="bnav" aria-label="Main">
      <NavLink to="/" end><FeedIcon />Feed</NavLink>
      <NavLink to="/canteens"><StoreIcon />Canteens</NavLink>
      <button className="plus" onClick={openPost} aria-label="Post your plate">
        <PlusIcon size={24} style={{ strokeWidth: 2.6 }} />
      </button>
      <NavLink to="/top"><TrophyIcon size={24} />Top</NavLink>
      <NavLink to="/profile"><UserIcon size={24} />Profile</NavLink>
    </nav>
  )
}
