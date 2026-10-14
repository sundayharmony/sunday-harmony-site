const GOLD = '#b8943f'
const GOLD_LIGHT = '#d9bf7c'
const INK = '#0a0a0a'
const LINE = 'rgba(10,10,10,0.14)'

const stacks = [
  { x: 52, coins: 2 },
  { x: 128, coins: 4 },
  { x: 204, coins: 6 },
  { x: 280, coins: 8 },
  { x: 356, coins: 11 },
]
const COIN_W = 56
const COIN_H = 14
const COIN_STEP = 13
const BASE_Y = 424

function CoinStack({ x, coins, delay }: { x: number; coins: number; delay: number }) {
  return (
    <g className="hero-rise" style={{ animationDelay: `${delay}s` }}>
      {Array.from({ length: coins }).map((_, i) => {
        const y = BASE_Y - (i + 1) * COIN_STEP - (COIN_H - COIN_STEP)
        const isTop = i === coins - 1
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={COIN_W}
              height={COIN_H}
              rx={7}
              fill={i % 2 === 0 ? GOLD : GOLD_LIGHT}
              stroke="rgba(10,10,10,0.16)"
            />
            <rect x={x + 8} y={y + 3} width={COIN_W - 16} height={2} rx={1} fill="white" opacity={isTop ? 0.7 : 0.35} />
          </g>
        )
      })}
    </g>
  )
}

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

/** Decorative funding hero art with no copy: coin stacks climbing like stairs, a milestone flag, and floating tiles. */
export default function FundingHeroVisual() {
  const topStack = stacks[stacks.length - 1]
  const topY = BASE_Y - topStack.coins * COIN_STEP - (COIN_H - COIN_STEP)
  const flagX = topStack.x + COIN_W / 2

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
          <radialGradient id="fundGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.35" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fundGround" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#efe8d8" />
            <stop offset="100%" stopColor="#fbf9f4" />
          </linearGradient>
          <linearGradient id="fundPath" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={INK} stopOpacity="0.3" />
            <stop offset="100%" stopColor={GOLD} />
          </linearGradient>
        </defs>

        <g className="hero-sun">
          <circle cx="392" cy="84" r="96" fill="url(#fundGlow)" />
          <circle cx="392" cy="84" r="62" stroke={GOLD} strokeOpacity="0.22" />
          <circle cx="392" cy="84" r="40" stroke={GOLD} strokeOpacity="0.35" />
        </g>

        <rect x="0" y="424" width="480" height="96" fill="url(#fundGround)" />
        <line x1="0" y1="424" x2="480" y2="424" stroke={LINE} />
        <ellipse cx="240" cy="432" rx="210" ry="6" fill={INK} opacity="0.06" />

        {stacks.map((stack, i) => (
          <CoinStack key={stack.x} x={stack.x} coins={stack.coins} delay={i * 0.18} />
        ))}

        <g className="hero-sway" style={{ animationDelay: '-1s' }}>
          <path d="M70 396 C70 386 72 380 70 372" stroke={INK} strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
          <path d="M70 384 C62 382 59 376 61 370 C68 371 72 377 70 384 Z" fill={GOLD} opacity="0.85" />
          <path d="M71 380 C79 378 82 372 80 366 C73 367 69 372 71 380 Z" fill={GOLD} opacity="0.6" />
        </g>

        <line x1={flagX} y1={topY} x2={flagX} y2={topY - 46} stroke={INK} strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />
        <path d={`M${flagX} ${topY - 46} L${flagX + 28} ${topY - 38} L${flagX} ${topY - 28} Z`} fill={GOLD} className="hero-twinkle" />

        <path
          d="M64 330 C130 318 190 290 244 246 C296 204 340 150 372 96"
          stroke="url(#fundPath)"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="hero-dash"
        />

        <Tile x={22} y={96} className="hero-float-a">
          <path
            d="M32 12 L48 18 V32 C48 42 41 49 32 53 C23 49 16 42 16 32 V18 Z"
            fill={GOLD}
            fillOpacity="0.16"
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <polyline points="24,32 30,38 41,26" stroke={GOLD} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </Tile>

        <Tile x={158} y={58} className="hero-float-b">
          <rect x="14" y="16" width="36" height="34" rx="5" stroke={INK} strokeWidth="2" />
          <rect x="14" y="16" width="36" height="9" rx="4" fill={GOLD} fillOpacity="0.9" />
          <line x1="22" y1="11" x2="22" y2="20" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="42" y1="11" x2="42" y2="20" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => (
              <rect
                key={`${r}-${c}`}
                x={19 + c * 10}
                y={30 + r * 6.5}
                width="5"
                height="4"
                rx="1"
                fill={r === 2 && c === 1 ? GOLD : INK}
                opacity={r === 2 && c === 1 ? 1 : 0.25}
              />
            ))
          )}
        </Tile>

        <Tile x={394} y={196} className="hero-float-c">
          <path
            d="M18 12 H38 L48 22 V52 H18 Z"
            fill="white"
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M38 12 V22 H48" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <line x1="24" y1="32" x2="42" y2="32" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="24" y1="39" x2="42" y2="39" stroke={INK} strokeOpacity="0.3" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="24" y1="46" x2="34" y2="46" stroke={INK} strokeOpacity="0.3" strokeWidth="2.5" strokeLinecap="round" />
        </Tile>

        <Tile x={300} y={150} className="hero-float-d">
          <path d="M12 28 L32 12 L52 28" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="17" y="28" width="30" height="22" rx="2" fill="white" stroke={INK} strokeWidth="2" />
          <path d="M14 28 H50 V34 C47 38 41 38 38 34 C35 38 29 38 26 34 C23 38 17 38 14 34 Z" fill={GOLD} />
          <rect x="28" y="40" width="8" height="10" rx="1" fill={INK} opacity="0.85" />
        </Tile>

        <g className="hero-float hero-float-a" style={{ animationDelay: '-2.2s' }}>
          <circle cx="246" cy="170" r="11" fill={GOLD} stroke="rgba(10,10,10,0.2)" />
          <circle cx="246" cy="170" r="6.5" stroke="white" strokeOpacity="0.8" />
        </g>
        <g className="hero-float hero-float-c" style={{ animationDelay: '-0.8s' }}>
          <circle cx="436" cy="332" r="9" fill={GOLD_LIGHT} stroke="rgba(10,10,10,0.2)" />
          <circle cx="436" cy="332" r="5" stroke="white" strokeOpacity="0.8" />
        </g>

        <circle cx="120" cy="214" r="2.5" fill={GOLD} className="hero-twinkle" />
        <circle cx="206" cy="108" r="2" fill={GOLD} className="hero-twinkle" style={{ animationDelay: '-1.2s' }} />
        <circle cx="352" cy="64" r="2.5" fill={GOLD} className="hero-twinkle" style={{ animationDelay: '-2.1s' }} />
        <circle cx="430" cy="262" r="2" fill={GOLD} className="hero-twinkle" style={{ animationDelay: '-0.6s' }} />
      </svg>
    </div>
  )
}
