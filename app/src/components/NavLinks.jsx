import { Link as RRLink, NavLink as RRNavLink } from 'react-router'
import { REDUCED_MOTION } from '../lib/motion'

// index.html wrapped every route change in document.startViewTransition (skipped under
// reduced motion). React Router does the same when viewTransition is set.

export const Link = props => <RRLink viewTransition={!REDUCED_MOTION} {...props} />

/** NavLink sets aria-current="page", which the tab and bottom-bar CSS keys off. */
export const NavLink = ({ className, ...props }) => (
  <RRNavLink viewTransition={!REDUCED_MOTION} className={className ?? ''} {...props} />
)
