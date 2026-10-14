const GOLD = '#b8943f'
const INK = '#0a0a0a'
const LINE = 'rgba(10,10,10,0.14)'

function Windows({
  x,
  y,
  cols,
  rows,
  w,
  h,
  gapX,
  gapY,
  litEvery,
}: {
  x: number
  y: number
  cols: number
  rows: number
  w: number
  h: number
  gapX: number
  gapY: number
  litEvery: number
}) {
  const cells = []
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = (r * cols + c) % litEvery === 0
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={x + c * (w + gapX)}
          y={y + r * (h + gapY)}
          width={w}
          height={h}
          rx={2}
          fill={lit ? GOLD : '#f0ebe3'}
          opacity={lit ? 0.9 : 1}
          className={lit ? 'hero-twinkle' : undefined}
          style={lit ? { animationDelay: `${((r + c) % 5) * 0.6}s` } : undefined}
        />
      )
    }
  }
  return <>{cells}</>
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

/** Decorative hero art with no copy: a storefront growing into a skyline, with a growth path and floating tiles. */
export default function HeroHarmonyVisual() {
  return (
    <div
      className="relative w-full overflow-hidden bg-gradient-to-b from-[#fbf9f4] via-white to-[#f4efe5]"
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
          <radialGradient id="heroSun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.42" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="heroGround" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#efe8d8" />
            <stop offset="100%" stopColor="#fbf9f4" />
          </linearGradient>
          <linearGradient id="heroPath" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={INK} stopOpacity="0.35" />
            <stop offset="100%" stopColor={GOLD} />
          </linearGradient>
        </defs>

        <g className="hero-sun">
          <circle cx="400" cy="100" r="86" fill="url(#heroSun)" />
          <circle cx="400" cy="100" r="34" fill={GOLD} opacity="0.22" />
          <circle cx="400" cy="100" r="34" stroke={GOLD} strokeOpacity="0.5" />
        </g>

        <rect x="0" y="420" width="480" height="100" fill="url(#heroGround)" />
        <line x1="0" y1="420" x2="480" y2="420" stroke={LINE} />
        <ellipse cx="240" cy="428" rx="210" ry="6" fill={INK} opacity="0.05" />

        <g className="hero-rise hero-rise-4">
          <rect x="366" y="244" width="64" height="176" rx="3" fill="#f7f4ee" stroke={LINE} />
          <Windows x={376} y={258} cols={3} rows={6} w={11} h={13} gapX={7} gapY={11} litEvery={4} />
        </g>

        <g className="hero-rise hero-rise-3">
          <rect x="282" y="168" width="76" height="252" rx="3" fill="white" stroke="rgba(10,10,10,0.18)" />
          <rect x="298" y="148" width="44" height="20" rx="2" fill="white" stroke="rgba(10,10,10,0.18)" />
          <line x1="320" y1="148" x2="320" y2="128" stroke={INK} strokeOpacity="0.5" strokeWidth="1.5" />
          <circle cx="320" cy="124" r="4" fill={GOLD} className="hero-twinkle" />
          <Windows x={294} y={186} cols={3} rows={8} w={14} h={14} gapX={8} gapY={12} litEvery={3} />
        </g>

        <g className="hero-rise hero-rise-2">
          <rect x="172" y="286" width="82" height="134" rx="3" fill="white" stroke="rgba(10,10,10,0.18)" />
          <Windows x={184} y={300} cols={3} rows={3} w={14} h={14} gapX={9} gapY={12} litEvery={4} />
          <rect x="204" y="384" width="22" height="36" rx="2" fill="#f0ebe3" stroke={LINE} />
        </g>

        <g className="hero-rise">
          <g>
            {[0, 1, 2, 3, 4].map((i) => (
              <rect
                key={i}
                x={38 + i * 22}
                y={314}
                width={22}
                height={24}
                fill={i % 2 === 0 ? GOLD : 'white'}
                stroke="rgba(10,10,10,0.18)"
              />
            ))}
            <path d="M34 314 L52 296 H132 L150 314 Z" fill="#f0ebe3" stroke="rgba(10,10,10,0.18)" />
          </g>
          <rect x="44" y="338" width="96" height="82" fill="white" stroke="rgba(10,10,10,0.18)" />
          <rect x="52" y="352" width="26" height="28" rx="2" fill="#f0ebe3" stroke={LINE} />
          <rect x="112" y="352" width="20" height="28" rx="2" fill="#f0ebe3" stroke={LINE} />
          <rect x="86" y="372" width="22" height="48" rx="2" fill={INK} opacity="0.88" />
          <circle cx="102" cy="398" r="1.8" fill={GOLD} />
          <circle cx="92" cy="362" r="5" fill={GOLD} className="hero-twinkle" />
        </g>

        <g className="hero-sway">
          <path d="M160 420 C160 404 163 394 160 380" stroke={INK} strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
          <path d="M160 392 C150 390 146 382 148 374 C157 375 162 382 160 392 Z" fill={GOLD} opacity="0.85" />
          <path d="M161 386 C171 384 175 376 173 368 C164 369 159 376 161 386 Z" fill={GOLD} opacity="0.6" />
        </g>
        <g className="hero-sway" style={{ animationDelay: '-2s' }}>
          <path d="M262 420 C262 410 264 404 262 396" stroke={INK} strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
          <path d="M262 404 C254 402 251 396 253 390 C260 391 264 397 262 404 Z" fill={GOLD} opacity="0.8" />
          <path d="M263 400 C271 398 274 392 272 386 C265 387 261 392 263 400 Z" fill={GOLD} opacity="0.55" />
        </g>
        <g className="hero-sway" style={{ animationDelay: '-3.5s' }}>
          <path d="M448 420 C448 408 450 400 448 390" stroke={INK} strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
          <path d="M448 402 C440 400 437 394 439 388 C446 389 450 395 448 402 Z" fill={GOLD} opacity="0.7" />
          <path d="M449 397 C457 395 460 389 458 383 C451 384 447 389 449 397 Z" fill={GOLD} opacity="0.5" />
        </g>

        <path
          d="M82 292 C144 276 198 252 248 222 C292 196 322 156 350 114"
          stroke="url(#heroPath)"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="hero-dash"
        />
        <g transform="translate(350 114) rotate(-56)">
          <path d="M0 0 L-15 -8 L-15 8 Z" fill={GOLD} />
        </g>

        <Tile x={24} y={150} className="hero-float-a">
          <path d="M14 22 V50 H50" stroke={INK} strokeOpacity="0.2" strokeWidth="1.5" strokeLinecap="round" />
          <polyline
            points="18,42 28,32 35,38 48,20"
            stroke={GOLD}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="48" cy="20" r="3.5" fill={GOLD} />
        </Tile>

        <Tile x={170} y={80} className="hero-float-b">
          <circle cx="32" cy="32" r="17" stroke={INK} strokeWidth="2" />
          <circle cx="32" cy="32" r="11" stroke={GOLD} strokeWidth="2" />
          <line x1="32" y1="26" x2="32" y2="38" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="28" y1="29" x2="36" y2="29" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
          <line x1="28" y1="35" x2="36" y2="35" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
        </Tile>

        <Tile x={296} y={26} className="hero-float-c">
          <path
            d="M32 14 C23 14 18 21 18 28 C18 34 22 37 24 41 H40 C42 37 46 34 46 28 C46 21 41 14 32 14 Z"
            fill={GOLD}
            fillOpacity="0.18"
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line x1="26" y1="46" x2="38" y2="46" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <line x1="28" y1="51" x2="36" y2="51" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
        </Tile>

        <Tile x={398} y={206} className="hero-float-d">
          <circle cx="32" cy="32" r="12" stroke={INK} strokeWidth="2" />
          <circle cx="32" cy="32" r="4.5" fill={GOLD} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <line
              key={angle}
              x1="32"
              y1="13"
              x2="32"
              y2="19"
              stroke={INK}
              strokeWidth="3"
              strokeLinecap="round"
              transform={`rotate(${angle} 32 32)`}
            />
          ))}
        </Tile>

        <circle cx="120" cy="230" r="2.5" fill={GOLD} className="hero-twinkle" />
        <circle cx="228" cy="150" r="2" fill={GOLD} className="hero-twinkle" style={{ animationDelay: '-1.2s' }} />
        <circle cx="262" cy="96" r="2.5" fill={GOLD} className="hero-twinkle" style={{ animationDelay: '-2.1s' }} />
        <circle cx="372" cy="170" r="2" fill={GOLD} className="hero-twinkle" style={{ animationDelay: '-0.6s' }} />
      </svg>
    </div>
  )
}
