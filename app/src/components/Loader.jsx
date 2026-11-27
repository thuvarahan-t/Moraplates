import { useCallback, useEffect, useRef, useState } from 'react'
import { confetti } from '../lib/fx'

// Shown while a page loads: four friends at a canteen table, eating bite by bite while they chat.
// - Their heads and eyes follow the pointer (or the last tap). When nobody is pointing, they talk among themselves.
// - Each fork carries a morsel to the mouth and the plate empties one bite at a time, then gets a refill.
// - Tap a friend for a reaction; tap the shared bowl for a puff of steam.
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

// What the loader says it is doing, by seconds waited. Long waits get honest about the connection.
const STAGES = [
  [0, 'Setting the table'],
  [1.4, 'Plating up'],
  [3.5, 'Almost served'],
  [8, 'The canteen queue is long today…'],
  [16, 'Still cooking. Check your connection if this keeps going.'],
]

const REACTIONS = ['Yum!', 'Machan!', 'So good', 'Hi! 👋', 'Rice & curry!', 'Share?', '10/10', 'Kottu ftw']

// [x, skin, shirt, food, long hair, seconds per bite]: different paces so they never eat in lockstep.
const FRIENDS = [
  [62, '#C98B5E', '#E8492F', '#B5652B', false, 2.4],
  [128, '#8D5A3B', '#F2A922', '#F3E4C8', true, 2.9],
  [194, '#E0AC7E', '#2F9E5B', '#E9B44C', false, 2.6],
  [260, '#A8714A', '#7F77DD', '#D4537E', true, 3.2],
]
const HEAD_Y = 72
const BOWL = [160, 118]
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const pick = (arr, not) => { let v; do v = arr[Math.floor(Math.random() * arr.length)]; while (arr.length > 1 && v === not); return v }

function useFriendsGaze(svgRef, friendRefs) {
  const lastPointer = useRef(0)

  const lookAt = useCallback((i, tx, ty) => {
    const el = friendRefs.current[i]
    if (!el) return
    const dx = tx - FRIENDS[i][0], dy = ty - HEAD_Y
    const d = Math.hypot(dx, dy) || 1
    el.style.setProperty('--lx', ((dx / d) * 1.3).toFixed(2))
    el.style.setProperty('--ly', ((dy / d) * 1.1).toFixed(2))
    el.style.setProperty('--tilt', clamp(dx / 9, -8, 8).toFixed(1))
  }, [friendRefs])

  const lookAll = useCallback((tx, ty, except = -1) => {
    FRIENDS.forEach((_, i) => { if (i !== except) lookAt(i, tx, ty) })
  }, [lookAt])

  // Pointer anywhere on the page → everyone looks at it.
  useEffect(() => {
    let frame = 0, px = 0, py = 0
    const toSvg = (x, y) => {
      const m = svgRef.current?.getScreenCTM()
      if (!m) return null
      return new DOMPoint(x, y).matrixTransform(m.inverse())
    }
    const onMove = e => {
      px = e.clientX; py = e.clientY
      lastPointer.current = performance.now()
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const p = toSvg(px, py)
        if (p) lookAll(p.x, p.y)
      })
    }
    addEventListener('pointermove', onMove, { passive: true })
    addEventListener('pointerdown', onMove, { passive: true })
    return () => { removeEventListener('pointermove', onMove); removeEventListener('pointerdown', onMove); cancelAnimationFrame(frame) }
  }, [svgRef, lookAll])

  // Idle: one friend talks, the others turn to listen; the talker glances around the table.
  useEffect(() => {
    let speaker = 0
    const chat = () => {
      if (performance.now() - lastPointer.current < 2600) return
      speaker = pick([0, 1, 2, 3], speaker)
      FRIENDS.forEach((_, i) => {
        if (i === speaker) {
          const other = pick([0, 1, 2, 3].filter(j => j !== i))
          lookAt(i, FRIENDS[other][0], HEAD_Y + 4)
        } else lookAt(i, FRIENDS[speaker][0], HEAD_Y)
      })
    }
    chat()
    const t = setInterval(chat, 1900)
    return () => clearInterval(t)
  }, [lookAt])

  return { lookAll, lookAt, pause: () => { lastPointer.current = performance.now() } }
}

function Friends() {
  const svg = useRef(null)
  const friends = useRef([])
  const { lookAll, pause } = useFriendsGaze(svg, friends)
  const [cheer, setCheer] = useState(null)
  const [puff, setPuff] = useState(0)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!cheer) return
    const t = setTimeout(() => setCheer(null), 1400)
    return () => clearTimeout(t)
  }, [cheer])

  const tapFriend = (i, e) => {
    e.stopPropagation()
    setTouched(true)
    setCheer(c => ({ i, word: pick(REACTIONS, c?.word), key: Date.now() }))
    pause()
    lookAll(FRIENDS[i][0], HEAD_Y, i)
    if (e.clientX) confetti(e.clientX, e.clientY, 8)
  }
  const tapBowl = e => {
    e.stopPropagation()
    setTouched(true)
    setPuff(p => p + 1)
    pause()
    lookAll(...BOWL)
  }

  return (
    <div className="ld-stage">
      <svg ref={svg} className="ld-art" viewBox="0 0 320 172" aria-hidden="true">
        <defs>
          <radialGradient id="ld-glow" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#F2A922" stopOpacity=".35" /><stop offset="1" stopColor="#F2A922" stopOpacity="0" />
          </radialGradient>
          <filter id="ld-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".7" /></filter>
        </defs>
        <ellipse cx="160" cy="164" rx="146" ry="6" className="ld-shadow" />
        <ellipse cx="160" cy="118" rx="70" ry="30" fill="url(#ld-glow)" className="ld-glow" />

        {FRIENDS.map(([x, skin, shirt, food, longHair, pace], i) => (
          <g key={x} ref={el => { friends.current[i] = el }}
            className={'ld-f' + (cheer?.i === i ? ' cheer' : '')}
            transform={`translate(${x} 0)`}
            style={{ '--d': `${i * -0.7}s`, '--t': `${pace}s`, '--blink': `${3.1 + i * 0.9}s` }}
            onPointerDown={e => tapFriend(i, e)}>
            <rect x="-26" y="50" width="52" height="82" fill="transparent" className="ld-hit" />
            <g className="ld-body">
              {/* chair back */}
              <rect x="-21" y="88" width="42" height="40" rx="9" className="ld-chair" />
              <g className="ld-breathe">
                <path d="M-22 128 V102 a22 22 0 0 1 44 0 V128 Z" fill={shirt} />
                <path d="M-6 82 h12 v8 a6 6 0 0 1 -12 0z" fill={skin} />
              </g>
              {longHair && <path d="M-15 70 v24 q0 3 3 3 h4 v-21 M15 70 v24 q0 3 -3 3 h-4 v-21" fill="#2A1A17" />}
              <g className="ld-hand"><path d="M10 104 L9 120" stroke={shirt} strokeWidth="7" strokeLinecap="round" /></g>
              <g className="ld-look">
                <g className="ld-head">
                  <circle cy={HEAD_Y} r="15" fill={skin} />
                  <ellipse cx="-14.5" cy="74" rx="2.4" ry="3.2" fill={skin} /><ellipse cx="14.5" cy="74" rx="2.4" ry="3.2" fill={skin} />
                  <path d="M-15 70 a15 15 0 0 1 30 0 q-7 -6 -15 -5 q-8 -1 -15 5z" fill="#2A1A17" />
                  <g className="ld-eyes">
                    <ellipse cx="-5" cy="73" rx="2.9" ry="3.1" fill="#fff" /><ellipse cx="5" cy="73" rx="2.9" ry="3.1" fill="#fff" />
                    <g className="ld-pupils">
                      <circle cx="-5" cy="73" r="1.75" fill="#2A1A17" /><circle cx="5" cy="73" r="1.75" fill="#2A1A17" />
                      <circle cx="-4.4" cy="72.3" r=".55" fill="#fff" /><circle cx="5.6" cy="72.3" r=".55" fill="#fff" />
                    </g>
                  </g>
                  <ellipse className="ld-cheek" cx="-8.5" cy="79" rx="2.6" ry="1.5" /><ellipse className="ld-cheek" cx="8.5" cy="79" rx="2.6" ry="1.5" />
                  <ellipse className="ld-mouth" cy="81" rx="3" ry="1.4" fill="#6B1E2A" />
                  <path className="ld-smile" d="M-4 79.5 q4 4.5 8 0" fill="none" stroke="#6B1E2A" strokeWidth="1.6" strokeLinecap="round" />
                </g>
              </g>
              {/* plate, food that empties bite by bite, then the fork hand */}
              <ellipse cy="127.6" rx="18" ry="4.8" className="ld-plate-shadow" />
              <ellipse cy="127" rx="17" ry="4.5" fill="#FFFDF8" stroke="#EADBC8" />
              <g className="ld-food"><ellipse cy="124.6" rx="10" ry="3.4" fill={food} /><ellipse cx="-3" cy="123.6" rx="3.2" ry="1.1" fill="#fff" opacity=".28" /></g>
              <g className="ld-hand">
                <circle cx="9" cy="121" r="4" fill={skin} />
                <path d="M9 121 L3 117" stroke="#B9A79E" strokeWidth="2" strokeLinecap="round" />
                <ellipse cx="2" cy="116.5" rx="3" ry="1.8" fill="#B9A79E" />
                <ellipse className="ld-morsel" cx="2" cy="115.2" rx="2.6" ry="1.6" fill={food} />
              </g>
            </g>
            {cheer?.i === i && (
              <g className="ld-bubble" key={cheer.key}>
                <rect x="-30" y="22" width="60" height="20" rx="10" />
                <path d="M-4 41.5 L0 48 L4 41.5z" />
                <text y="35.6" textAnchor="middle">{cheer.word}</text>
              </g>
            )}
          </g>
        ))}

        {/* shared bowl with steam; tap it */}
        <g className="ld-bowl" onPointerDown={tapBowl}>
          <rect x="142" y="100" width="36" height="28" fill="transparent" />
          <g className={'ld-steam' + (puff ? ' puff' : '')} key={puff} filter="url(#ld-soft)">
            <path d="M152 112 q-5 -7 0 -13 q5 -6 0 -12" /><path d="M160 110 q-5 -8 0 -15 q5 -7 0 -14" /><path d="M168 112 q-5 -7 0 -13 q5 -6 0 -12" />
          </g>
          <path d="M138 121 q22 14 44 0 z" fill="#FFFDF8" stroke="#EADBC8" />
          <ellipse cx="160" cy="121" rx="22" ry="3.6" fill="#E8492F" />
          <ellipse cx="154" cy="120.2" rx="6" ry="1.2" fill="#fff" opacity=".3" />
        </g>

        <rect x="14" y="127" width="292" height="9" rx="4.5" className="ld-table" />
        <rect x="20" y="128" width="280" height="2" rx="1" className="ld-table-hi" />
        <rect x="40" y="136" width="8" height="24" rx="3" className="ld-table" /><rect x="272" y="136" width="8" height="24" rx="3" className="ld-table" />
      </svg>
      <p className={'ld-hint' + (touched ? ' gone' : '')} aria-hidden="true">Psst… tap a friend, or the bowl</p>
    </div>
  )
}

export default function Loader({ label = 'Loading' }) {
  const [q, setQ] = useState(() => Math.floor(Math.random() * QUOTES.length))
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setQ(i => (i + 1) % QUOTES.length), 4200)
    const start = performance.now()
    const s = setInterval(() => {
      const secs = (performance.now() - start) / 1000
      setStage(STAGES.reduce((at, [from], i) => (secs >= from ? i : at), 0))
    }, 250)
    return () => { clearInterval(t); clearInterval(s) }
  }, [])
  const [text, by] = QUOTES[q]

  return (
    <div className="loader">
      <Friends />
      <div className="ld-status" role="status" aria-live="polite">
        <span className="sr">{label}…</span>
        <span className="ld-stage-txt" key={stage} aria-hidden="true">{STAGES[stage][1]}</span>
        <span className="ld-bar" aria-hidden="true"><i /></span>
      </div>
      <figure className="ld-quote" key={q}>
        <blockquote>“{text}”</blockquote>
        {by && <figcaption>{by}</figcaption>}
      </figure>
    </div>
  )
}
