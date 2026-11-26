import { useEffect, useState } from 'react'

// Shown while a page loads: four friends at a table taking turns to eat, with a food quote underneath.
// It fades in after a short delay so fast loads never flash it.

const QUOTES = [
  ['Food tastes better when you eat it with friends.', ''],
  ['First we eat, then we do everything else.', 'M.F.K. Fisher'],
  ['People who love to eat are always the best people.', 'Julia Child'],
  ['There is no sincerer love than the love of food.', 'George Bernard Shaw'],
  ['One cannot think well, love well, sleep well, if one has not dined well.', 'Virginia Woolf'],
  ['Life is uncertain. Eat dessert first.', 'Ernestine Ulmer'],
  ['A good lunch fixes a long lab.', ''],
  ['Save a seat, the kottu is on its way.', ''],
]

// [x, skin, shirt, food, long hair]
const FRIENDS = [
  [62, '#C98B5E', '#E8492F', '#B5652B', false],
  [128, '#8D5A3B', '#F2A922', '#F3E4C8', true],
  [194, '#E0AC7E', '#2F9E5B', '#E9B44C', false],
  [260, '#A8714A', '#7F77DD', '#D4537E', true],
]

function Friends() {
  return (
    <svg className="ld-art" viewBox="0 0 320 170" aria-hidden="true">
      <ellipse cx="160" cy="160" rx="140" ry="6" className="ld-shadow" />
      {/* shared bowl between the friends, steaming */}
      <g className="ld-steam">
        <path d="M156 112 q-4 -7 0 -13 q4 -6 0 -12" /><path d="M164 110 q-4 -7 0 -13 q4 -6 0 -12" />
      </g>
      {FRIENDS.map(([x, skin, shirt, food, longHair], i) => (
        <g key={x} transform={`translate(${x} 0)`} style={{ '--d': `${i * 0.6}s` }}>
          <path d="M-22 128 V102 a22 22 0 0 1 44 0 V128 Z" fill={shirt} />
          {longHair && <path d="M-15 70 v22 h6 v-18 M15 70 v22 h-6 v-18" fill="#2A1A17" />}
          <g className="ld-hand"><path d="M10 104 L9 120" stroke={shirt} strokeWidth="7" strokeLinecap="round" /></g>
          <g className="ld-head">
            <circle cy="72" r="15" fill={skin} />
            <path d="M-15 70 a15 15 0 0 1 30 0 q-7 -6 -15 -5 q-8 -1 -15 5z" fill="#2A1A17" />
            <circle cx="-5" cy="73" r="1.7" fill="#2A1A17" /><circle cx="5" cy="73" r="1.7" fill="#2A1A17" />
            <ellipse className="ld-mouth" cy="80" rx="3" ry="1.4" fill="#6B1E2A" />
          </g>
          <ellipse cy="127" rx="17" ry="4.5" fill="#FFFDF8" stroke="#EADBC8" />
          <ellipse cy="124.6" rx="10" ry="3.4" fill={food} />
          <g className="ld-hand">
            <circle cx="9" cy="121" r="4" fill={skin} />
            <path d="M9 121 L3 117" stroke="#B9A79E" strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="2" cy="116.5" rx="3" ry="1.8" fill="#B9A79E" />
          </g>
        </g>
      ))}
      <path d="M140 126 q20 10 40 0 z" fill="#FFFDF8" stroke="#EADBC8" />
      <rect x="18" y="127" width="284" height="9" rx="4.5" className="ld-table" />
      <rect x="40" y="136" width="8" height="22" rx="3" className="ld-table" /><rect x="272" y="136" width="8" height="22" rx="3" className="ld-table" />
    </svg>
  )
}

export default function Loader({ label = 'Loading' }) {
  const [q, setQ] = useState(() => Math.floor(Math.random() * QUOTES.length))
  useEffect(() => {
    const t = setInterval(() => setQ(i => (i + 1) % QUOTES.length), 3600)
    return () => clearInterval(t)
  }, [])
  const [text, by] = QUOTES[q]

  return (
    <div className="loader" role="status" aria-live="polite">
      <span className="sr">{label}…</span>
      <Friends />
      <figure className="ld-quote" key={q}>
        <blockquote>“{text}”</blockquote>
        {by && <figcaption>{by}</figcaption>}
      </figure>
    </div>
  )
}
