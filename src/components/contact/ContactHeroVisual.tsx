const GOLD = '#b8943f'
const GOLD_LIGHT = '#d9bf7c'
const INK = '#0a0a0a'
const LINE = 'rgba(10,10,10,0.14)'

function Tile({ x, y, className, children }: { x: number; y: number; className: string; children: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={`hero-float ${className}`}>
        <rect width="64" height="64" rx="16" fill="white" stroke="rgba(10,10,10,0.09)" />
        {children}
      </g>
    </g>
  )
}

/** Decorative contact hero: conversation bubbles, an envelope in motion, and floating tiles (no copy). */
export default function ContactHeroVisual() {
  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl border border-brand-border bg-gradient-to-b from-[#fbf9f4] via-white to-[#f4efe5] shadow-sm"
      style={{ aspectRatio: '480 / 520' }}
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 480 520"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMax meet"
      >
        <defs>
          <radialGradient id="contactGlow" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.28" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="contactDesk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#efe8d8" />
            <stop offset="100%" stopColor="#fbf9f4" />
          </linearGradient>
        </defs>

        <ellipse cx="240" cy="200" rx="200" ry="160" fill="url(#contactGlow)" />
        <rect x="0" y="400" width="480" height="120" fill="url(#contactDesk)" />
        <path d="M0 400 Q240 388 480 400 L480 520 L0 520 Z" fill="#ebe3d4" opacity="0.5" />

        <g className="hero-rise" style={{ animationDelay: '0.1s' }}>
          <rect x="88" y="318" width="304" height="12" rx="6" fill={LINE} />
          <rect x="108" y="268" width="264" height="56" rx="14" fill="white" stroke={LINE} strokeWidth="1.5" />
          <rect x="128" y="286" width="120" height="8" rx="4" fill="#e8e4dc" />
          <rect x="128" y="302" width="180" height="6" rx="3" fill="#f0ebe3" />
          <circle cx="340" cy="296" r="14" fill={GOLD} opacity="0.85" />
          <path d="M334 296 L338 300 L346 292" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        <g className="hero-sway" style={{ animationDelay: '0.3s' }}>
          <rect x="56" y="148" width="168" height="72" rx="18" fill="white" stroke={LINE} strokeWidth="1.5" />
          <rect x="76" y="172" width="100" height="8" rx="4" fill="#e0dbd2" />
          <rect x="76" y="188" width="128" height="6" rx="3" fill="#f0ebe3" />
          <path d="M56 196 L40 210 L56 204 Z" fill="white" stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
        </g>

        <g className="hero-sway hero-float-a" style={{ animationDelay: '0.6s' }}>
          <rect x="268" y="108" width="156" height="64" rx="16" fill={INK} opacity="0.92" />
          <rect x="288" y="128" width="88" height="8" rx="4" fill="white" opacity="0.9" />
          <rect x="288" y="144" width="116" height="6" rx="3" fill="white" opacity="0.45" />
          <path d="M424 156 L440 168 L424 162 Z" fill={INK} opacity="0.92" />
        </g>

        <g className="hero-float hero-float-b">
          <g transform="translate(196 52)">
            <rect x="0" y="20" width="88" height="56" rx="10" fill="white" stroke={LINE} strokeWidth="1.5" transform="rotate(-8 44 48)" />
            <path
              d="M12 36 L44 58 L76 36"
              stroke={GOLD}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="rotate(-8 44 48)"
            />
            <rect x="8" y="28" width="72" height="4" rx="2" fill={GOLD_LIGHT} opacity="0.6" transform="rotate(-8 44 48)" />
          </g>
        </g>

        <path
          className="hero-dash"
          d="M120 380 C200 320 280 300 360 220"
          stroke={GOLD}
          strokeWidth="2"
          strokeDasharray="8 10"
          strokeLinecap="round"
          opacity="0.55"
        />

        <circle className="hero-twinkle" cx="72" cy="96" r="4" fill={GOLD} style={{ animationDelay: '0.2s' }} />
        <circle className="hero-twinkle" cx="412" cy="248" r="3" fill={GOLD_LIGHT} style={{ animationDelay: '1.1s' }} />
        <circle className="hero-twinkle" cx="388" cy="88" r="3.5" fill={GOLD} style={{ animationDelay: '0.7s' }} />

        <Tile x={32} y={232} className="hero-float-c">
          <rect x="18" y="22" width="28" height="20" rx="4" stroke={INK} strokeWidth="1.5" fill="none" />
          <path d="M22 26 L32 34 L42 26" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </Tile>

        <Tile x={372} y={312} className="hero-float-d">
          <rect x="16" y="18" width="32" height="28" rx="6" stroke={INK} strokeWidth="1.5" fill="none" />
          <path d="M16 24 H48" stroke={INK} strokeWidth="1.5" />
          <rect x="22" y="30" width="8" height="8" rx="2" fill={GOLD} opacity="0.7" />
          <rect x="34" y="30" width="8" height="8" rx="2" fill="#e8e4dc" />
        </Tile>

        <Tile x={16} y={340} className="hero-float-a">
          <circle cx="32" cy="28" r="10" stroke={INK} strokeWidth="1.5" fill="none" />
          <path d="M32 22 V28 L36 32" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M44 40 H20" stroke={INK} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        </Tile>

        <Tile x={388} y={168} className="hero-float-b">
          <path d="M20 44 L32 20 L44 44 Z" stroke={INK} strokeWidth="1.5" fill={GOLD_LIGHT} fillOpacity="0.35" strokeLinejoin="round" />
          <rect x="28" y="38" width="8" height="10" rx="2" fill={GOLD} />
        </Tile>
      </svg>
    </div>
  )
}
