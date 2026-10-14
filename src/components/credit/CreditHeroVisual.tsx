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

function BureauPillar({ x, label, height, delay }: { x: number; label: string; height: number; delay: number }) {
  const baseY = 400
  return (
    <g className="hero-rise" style={{ animationDelay: `${delay}s` }}>
      <rect x={x} y={baseY - height} width={72} height={height} rx="10" fill="white" stroke={LINE} strokeWidth="1.5" />
      <rect x={x + 10} y={baseY - height + 14} width={52} height={6} rx="3" fill="#e8e4dc" />
      <rect x={x + 10} y={baseY - height + 28} width={40} height={6} rx="3" fill="#f0ebe3" />
      <text x={x + 36} y={baseY + 22} textAnchor="middle" fill={INK} fontSize="11" fontWeight="700" opacity="0.75">
        {label}
      </text>
    </g>
  )
}

/** Decorative credit hero: score arc, bureau pillars, and floating tiles (no copy). */
export default function CreditHeroVisual() {
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
          <radialGradient id="creditGlow" cx="50%" cy="35%" r="50%">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.3" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="240" cy="180" rx="190" ry="150" fill="url(#creditGlow)" />

        <g className="hero-sway" style={{ animationDelay: '-0.5s' }}>
          <path
            d="M 120 280 A 120 120 0 0 1 360 280"
            stroke="#e8e4dc"
            strokeWidth="18"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 132 280 A 108 108 0 0 1 348 280"
            stroke={GOLD}
            strokeWidth="14"
            strokeLinecap="round"
            fill="none"
            className="hero-dash"
            strokeDasharray="340"
            strokeDashoffset="80"
          />
          <circle cx="240" cy="280" r="8" fill={GOLD} className="hero-twinkle" />
          <rect x="208" y="188" width="64" height="44" rx="12" fill="white" stroke={LINE} />
          <text x="240" y="218" textAnchor="middle" fill={INK} fontSize="22" fontWeight="800" fontFamily="Georgia, serif">
            720
          </text>
        </g>

        <BureauPillar x={56} label="EXP" height={120} delay={0.1} />
        <BureauPillar x={156} label="EQF" height={156} delay={0.25} />
        <BureauPillar x={256} label="TU" height={132} delay={0.4} />
        <BureauPillar x={356} label="YOU" height={168} delay={0.55} />

        <rect x="0" y="418" width="480" height="102" fill="#f4efe5" />
        <line x1="0" y1="418" x2="480" y2="418" stroke={LINE} />

        <path
          className="hero-dash"
          d="M88 360 C160 300 320 300 392 240"
          stroke={GOLD}
          strokeWidth="2"
          strokeDasharray="8 10"
          opacity="0.5"
        />

        <circle className="hero-twinkle" cx="96" cy="120" r="4" fill={GOLD} style={{ animationDelay: '0.3s' }} />
        <circle className="hero-twinkle" cx="400" cy="96" r="3" fill={GOLD_LIGHT} style={{ animationDelay: '0.9s' }} />

        <Tile x={20} y={72} className="hero-float-a">
          <path d="M20 40 H44 V24 H20 Z" stroke={INK} strokeWidth="1.5" fill={GOLD_LIGHT} fillOpacity="0.35" />
          <path d="M24 28 H40 M24 34 H36" stroke={INK} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        </Tile>

        <Tile x={388} y={200} className="hero-float-b">
          <path
            d="M18 36 L32 18 L46 36"
            stroke={INK}
            strokeWidth="1.5"
            fill="none"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="38" r="6" fill={GOLD} opacity="0.85" />
        </Tile>

        <Tile x={12} y={300} className="hero-float-c">
          <rect x="18" y="20" width="28" height="22" rx="4" stroke={INK} strokeWidth="1.5" fill="none" />
          <path d="M22 26 L30 32 L42 22" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Tile>

        <Tile x={392} y={320} className="hero-float-d">
          <circle cx="32" cy="32" r="14" stroke={INK} strokeWidth="1.5" fill="none" />
          <path d="M32 24 V32 L38 36" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" />
        </Tile>
      </svg>
    </div>
  )
}
