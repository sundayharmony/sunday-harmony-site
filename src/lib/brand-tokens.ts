/**
 * Shared brand tokens — keep in sync with tailwind.config.ts and globals.css.
 */

export const brandColors = {
  accent: '#b8943f',
  accentSoft: '#f0ebe3',
  text: '#0a0a0a',
  muted: '#525252',
  dim: '#a3a3a3',
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
