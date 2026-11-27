import { BadgeCheck } from 'lucide-react'
import { VERIFIED_BADGE_COUNT } from '../lib/badges'
import '../styles/social-features.css'

export default function VerifiedBadge() {
  const label = `Verified · ${VERIFIED_BADGE_COUNT} or more badges earned`
  return (
    <span className="verified-badge" role="img" aria-label={label} title={label}>
      <BadgeCheck size="1em" aria-hidden="true" />
    </span>
  )
}
