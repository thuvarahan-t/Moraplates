// The MoraPlates plate from the design handoff's logo board (design-screens/Main.html).
//  intro: "set a new plate": the plate spins in, its rim draws, the three food segments fill
//         in turn, fork and spoon slide in, the centre dot pulses, then steam rises (Create account).
//  warm:  the finished plate gently bobbing with steam (Sign in: your plate's still warm).

export default function PlateScene({ intro = false }) {
  return (
    <svg className={'ps ' + (intro ? 'ps-intro' : 'ps-warm')} viewBox="0 0 320 260" aria-hidden="true">
      <g className="ps-steam" fill="none" stroke="#E8492F" strokeWidth="5" strokeLinecap="round">
        <path d="M138 52 q-9 -11 0 -21 q9 -10 0 -21" />
        <path d="M160 48 q-9 -11 0 -21 q9 -10 0 -21" />
        <path d="M182 52 q-9 -11 0 -21 q9 -10 0 -21" />
      </g>
      <g className="ps-fork">
        <g stroke="#6B1E2A" strokeWidth="6" strokeLinecap="round" fill="none">
          <line x1="30" y1="92" x2="30" y2="120" /><line x1="42" y1="92" x2="42" y2="120" /><line x1="54" y1="92" x2="54" y2="120" />
          <path d="M30 120 q12 18 24 0" />
          <line x1="42" y1="132" x2="42" y2="222" strokeWidth="9" />
        </g>
      </g>
      <g className="ps-spoon">
        <ellipse cx="278" cy="110" rx="14" ry="20" fill="#6B1E2A" />
        <line x1="278" y1="128" x2="278" y2="222" stroke="#6B1E2A" strokeWidth="9" strokeLinecap="round" />
      </g>
      <g className="ps-plate">
        <circle cx="160" cy="150" r="88" fill="#FFFFFF" stroke="#6B1E2A" strokeWidth="6" />
        <circle className="ps-draw" cx="160" cy="150" r="70" fill="none" stroke="#6B1E2A" strokeOpacity="0.3" strokeWidth="2.5" strokeDasharray="440" style={{ '--l': 440, '--t': '.6s', '--at': '.6s' }} />
        <circle className="ps-draw" cx="160" cy="150" r="30" fill="none" stroke="#E8492F" strokeWidth="60" strokeDasharray="80.8 200" transform="rotate(-90 160 150)" style={{ '--l': 80.8, '--t': '.45s', '--at': '.85s' }} />
        <circle className="ps-draw" cx="160" cy="150" r="30" fill="none" stroke="#F2A922" strokeWidth="60" strokeDasharray="58.2 200" transform="rotate(72 160 150)" style={{ '--l': 58.2, '--t': '.4s', '--at': '1.2s' }} />
        <circle className="ps-draw" cx="160" cy="150" r="30" fill="none" stroke="#2F9E5B" strokeWidth="60" strokeDasharray="37.5 200" transform="rotate(190.8 160 150)" style={{ '--l': 37.5, '--t': '.35s', '--at': '1.5s' }} />
        <circle cx="160" cy="150" r="17" fill="#FFFFFF" />
        <circle className="ps-dot" cx="160" cy="150" r="7" fill="#6B1E2A" />
      </g>
    </svg>
  )
}
