import { useRef, useState } from 'react'
import { confetti } from '../lib/fx'

// 1–5 stars, folded into the three ratings the feed already understands: 1–2 Avoid, 3 Okay, 4–5 Super.
export const starsToRating = n => (n >= 4 ? 'super' : n === 3 ? 'okay' : 'avoid')

const VERDICT = {
  1: ['avoid', '😖', 'Avoid', 'Never again'],
  2: ['avoid', '😕', 'Avoid', 'Not worth it'],
  3: ['okay', '🙂', 'Okay', "It's fine"],
  4: ['super', '😋', 'Super', 'Really good'],
  5: ['super', '🤩', 'Super', 'Must try!'],
}

const Star = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" />
  </svg>
)

export default function StarRating({ value, onChange, disabled }) {
  const [hover, setHover] = useState(0)
  const row = useRef(null)
  const shown = hover || value
  const [tone, face, word, sub] = VERDICT[shown] ?? []

  const choose = (n, e) => {
    onChange(n)
    if (n === 5) {
      const r = (e?.currentTarget ?? row.current).getBoundingClientRect()
      confetti(r.left + r.width / 2, r.top + r.height / 2, 14)
    }
  }

  return (
    <fieldset className={'stars' + (tone ? ' t-' + tone : '')} disabled={disabled}>
      <legend>How was it?</legend>
      <div className="st-wrap">
        <div className="st-row" ref={row} onPointerLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map(n => (
            <label key={n} className={'st' + (n <= shown ? ' on' : '')} style={{ '--i': n }}
              onPointerEnter={e => e.pointerType === 'mouse' && setHover(n)}>
              <input type="radio" name="stars" value={n} checked={value === n}
                onChange={e => choose(n, { currentTarget: e.target.parentElement })}
                aria-label={`${n} star${n > 1 ? 's' : ''}: ${VERDICT[n][2]}, ${VERDICT[n][3]}`} />
              {/* re-keyed on change so the pop plays again */}
              <span className="st-ic" key={n <= value ? 'on' + value : 'off'}><Star /></span>
            </label>
          ))}
        </div>
        <div className="st-verdict" aria-live="polite">
          {shown ? (
            <span className={'st-chip ' + tone} key={shown}>
              <span className="st-face" aria-hidden="true">{face}</span>
              <b>{word}</b><small>{sub}</small>
            </span>
          ) : <span className="st-hint">Tap a star</span>}
        </div>
      </div>
    </fieldset>
  )
}
