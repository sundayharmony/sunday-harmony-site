/** Decorative hero art — no copy; three paths suggested by iconography only. */
export default function HeroHarmonyVisual() {
  return (
    <div
      className="relative w-full min-h-[380px] sm:min-h-[420px] lg:min-h-[460px] overflow-hidden bg-gradient-to-br from-neutral-50 via-white to-[#f7f4ee]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(184,148,63,0.12),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_75%,rgba(0,0,0,0.04),transparent_50%)]" />

      <svg
        className="absolute inset-0 h-full w-full text-brand-text"
        viewBox="0 0 400 460"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="heroArc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0a0a0a" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#b8943f" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="heroBar" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#e5e5e5" />
            <stop offset="100%" stopColor="#b8943f" />
          </linearGradient>
        </defs>

        <g className="hero-orbit-slow" style={{ transformOrigin: '200px 230px' }}>
          <circle cx="200" cy="230" r="118" stroke="url(#heroArc)" strokeWidth="1.5" />
        </g>
        <circle cx="200" cy="230" r="86" stroke="rgba(10,10,10,0.06)" strokeWidth="1" strokeDasharray="4 8" />

        <path
          d="M200 112 Q 280 180 318 248 Q 260 290 200 318 Q 140 290 82 248 Q 120 180 200 112"
          stroke="url(#heroArc)"
          strokeWidth="1"
          fill="rgba(240,235,227,0.35)"
        />

        <g transform="translate(118 148)">
          <g className="hero-float hero-float-a">
            <rect width="88" height="88" rx="20" fill="white" stroke="rgba(10,10,10,0.08)" strokeWidth="1" />
            <rect x="28" y="48" width="32" height="24" rx="4" stroke="currentColor" strokeWidth="2" />
            <path d="M24 48 L44 32 L64 48" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="44" cy="58" r="3" fill="#b8943f" />
          </g>
        </g>

        <g transform="translate(194 72)">
          <g className="hero-float hero-float-b">
            <rect width="88" height="88" rx="20" fill="white" stroke="rgba(10,10,10,0.08)" strokeWidth="1" />
            <circle cx="44" cy="44" r="22" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
            <path
              d="M44 30 L44 52 M34 42 L44 52 L54 42"
              stroke="#b8943f"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>

        <g transform="translate(248 198)">
          <g className="hero-float hero-float-c">
            <rect width="88" height="88" rx="20" fill="white" stroke="rgba(10,10,10,0.08)" strokeWidth="1" />
            <rect x="26" y="38" width="36" height="6" rx="3" fill="url(#heroBar)" />
            <rect x="26" y="50" width="28" height="6" rx="3" fill="url(#heroBar)" opacity="0.75" />
            <rect x="26" y="62" width="44" height="6" rx="3" fill="url(#heroBar)" opacity="0.55" />
          </g>
        </g>

        <g opacity="0.45">
          <line x1="162" y1="192" x2="238" y2="116" stroke="#b8943f" strokeWidth="1" strokeDasharray="3 6" />
          <line x1="206" y1="160" x2="292" y2="242" stroke="#b8943f" strokeWidth="1" strokeDasharray="3 6" />
          <line x1="162" y1="192" x2="292" y2="242" stroke="rgba(10,10,10,0.12)" strokeWidth="1" />
        </g>

        <circle cx="200" cy="230" r="10" fill="#b8943f" className="hero-pulse" />
        <circle cx="200" cy="230" r="18" stroke="#b8943f" strokeWidth="1" opacity="0.35" className="hero-pulse-ring" />
      </svg>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white/90 to-transparent pointer-events-none" />
    </div>
  )
}
