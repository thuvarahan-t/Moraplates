import '../styles/helena-avatar.css'

export default function HelenaAvatar({ className = '', size = 54 }) {
  return (
    <span className={`helena-avatar ${className}`} style={{ '--helena-avatar-size': `${size}px` }} aria-hidden="true">
      <span className="helena-avatar-disc">
        <span className="helena-avatar-hair" />
        <span className="helena-avatar-coat" />
        <span className="helena-avatar-face">
          <span className="helena-avatar-eyes" />
          <span className="helena-avatar-smile" />
        </span>
        <span className="helena-avatar-sleeve" />
        <span className="helena-avatar-spoon" />
        <span className="helena-avatar-hand" />
      </span>
      <span className="helena-avatar-steam">
        <span />
        <span />
      </span>
      <span className="helena-avatar-hat" />
    </span>
  )
}
