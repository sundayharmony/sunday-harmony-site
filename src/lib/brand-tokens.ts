/**
 * Shared brand tokens — keep in sync with tailwind.config.ts and globals.css.
 */

export const brandColors = {
  accent: '#b8943f',
  accentSoft: '#f0ebe3',
  /** Accent for text on light backgrounds (4.7:1 or better on white and the beige panels). Keep `accent` for fills, borders and text on dark. */
  accentInk: '#7f6427',
  text: '#0a0a0a',
  muted: '#525252',
  dim: '#737373',
  bg: '#ffffff',
  bgSoft: '#fafafa',
  border: '#e5e5e5',
  dark: '#171717',
  white: '#ffffff',
} as const

export const brandFonts = {
  family: 'Montserrat, ui-sans-serif, system-ui, sans-serif',
  weights: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
} as const

/** Homepage type. Change these, not the page styles. */
export const brandType = {
  display: 'clamp(2.15rem, 7vw, 5.25rem)',
  title: 'clamp(1.75rem, 4vw, 3rem)',
  body: '1.0625rem',
  small: '0.875rem',
  label: '0.6875rem',
  labelTracking: '0.16em',
  displayLeading: '0.98',
  bodyLeading: '1.55',
  displayWeight: 800,
} as const

/** Homepage motion. Lenis and hovers read these numbers. */
export const brandMotion = {
  ease: [0.22, 1, 0.36, 1] as const,
  easeCss: 'cubic-bezier(0.22, 1, 0.36, 1)',
  durationMs: 420,
  progressMs: 180,
  lenisLerp: 0.12,
  wheelMultiplier: 0.85,
} as const

/** Homepage spacing. */
export const brandSpace = {
  padX: '1.75rem',
  sectionY: '5.5rem',
  max: '1100px',
  heroMax: '1180px',
  gap: '1.25rem',
} as const

export const brandLogos = {
  black: '/logo-black.png',
  white: '/logo-white.png',
  aspectRatio: 991 / 587,
} as const

export const brandBackgrounds = {
  heroGradient: 'linear-gradient(to bottom right, #ffffff, #fafafa, #f5f5f5)',
  ctaGradient: 'linear-gradient(to bottom right, #fafafa, #f5f5f5)',
  darkGradient: 'linear-gradient(to bottom right, #171717, #0a0a0a)',
  gridPattern:
    'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
  radialGlow: 'radial-gradient(circle, rgba(0,0,0,0.04) 0%, transparent 70%)',
} as const

/** Public page palette from the approved homepage design (2026-11-22). Portals keep brandColors. */
export const publicColors = {
  text: '#1b1a17',
  muted: '#4a463e',
  bg: '#fbf7f0',
  bgSoft: '#f6efe2',
  accentSoft: '#f0e6d3',
  border: '#e6dbc6',
  goldText: '#8a6416',
} as const

/** CSS variables for public marketing pages. HomeMotion applies them. Portals do not. */
export function homeThemeVars(): Record<string, string> {
  return {
    '--home-accent': brandColors.accent,
    '--home-accent-soft': publicColors.accentSoft,
    '--home-text': publicColors.text,
    '--home-muted': publicColors.muted,
    '--home-gold-text': publicColors.goldText,
    '--home-dim': brandColors.dim,
    '--home-bg': publicColors.bg,
    '--home-bg-soft': publicColors.bgSoft,
    '--home-border': publicColors.border,
    '--home-display': brandType.display,
    '--home-title': brandType.title,
    '--home-body': brandType.body,
    '--home-small': brandType.small,
    '--home-label': brandType.label,
    '--home-label-tracking': brandType.labelTracking,
    '--home-display-leading': brandType.displayLeading,
    '--home-body-leading': String(brandType.bodyLeading),
    '--home-display-weight': '600',
    '--home-ease': brandMotion.easeCss,
    '--home-duration': `${brandMotion.durationMs}ms`,
    '--home-pad-x': brandSpace.padX,
    '--home-section-y': brandSpace.sectionY,
    '--home-max': brandSpace.max,
    '--home-hero-max': brandSpace.heroMax,
    '--home-gap': brandSpace.gap,
    '--home-hero-bg': publicColors.bg,
    '--home-grid': 'none',
    '--home-glow': 'none',
  }
}

export type BackgroundStyle = 'white' | 'soft' | 'dark'
export type LogoVariant = 'black' | 'white' | 'hidden'

export function resolveBackground(style: BackgroundStyle): {
  background: string
  textColor: string
  mutedColor: string
  logoVariant: LogoVariant
} {
  switch (style) {
    case 'dark':
      return {
        background: brandBackgrounds.darkGradient,
        textColor: brandColors.white,
        mutedColor: '#d4d4d4',
        logoVariant: 'white',
      }
    case 'soft':
      return {
        background: brandBackgrounds.heroGradient,
        textColor: brandColors.text,
        mutedColor: brandColors.muted,
        logoVariant: 'black',
      }
    default:
      return {
        background: brandColors.bg,
        textColor: brandColors.text,
        mutedColor: brandColors.muted,
        logoVariant: 'black',
      }
  }
}
