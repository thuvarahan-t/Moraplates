import { initialsOf } from '../lib/auth'
import { avatarStyle } from '../lib/format'
import ContentPhoto from './ContentPhoto'

/** Profile picture, or tinted initials when the student hasn't set one. Size comes from CSS (.av variants). */
export default function Avatar({ name, url, className = '' }) {
  return (
    <span className={'av ' + className} style={url ? undefined : avatarStyle(name)}>
      {url ? <ContentPhoto src={url} alt="" loading="lazy" /> : initialsOf(name)}
    </span>
  )
}
