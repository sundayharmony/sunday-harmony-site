import type { Config } from 'tailwindcss'
import { brandColors, brandMotion } from './src/lib/brand-tokens'

/**
 * Colors come from src/lib/brand-tokens.ts.
 * Keep the same hex values on :root in src/styles/globals.css.
 */

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: brandColors.accent,
          soft: brandColors.accentSoft,
          ink: brandColors.accentInk,
          foreground: brandColors.text,
        },
        brand: {
          bg: brandColors.bg,
          'bg-soft': brandColors.bgSoft,
          paper: brandColors.paper,
          card: 'rgba(27, 26, 23, 0.02)',
          'card-hover': 'rgba(27, 26, 23, 0.05)',
          border: brandColors.border,
          /** @deprecated use text-accent / border-accent — kept for gradual migration */
          gold: brandColors.accent,
          'gold-light': '#c4a052',
          /** Subdued semantic (admin badges, alerts) */
          green: '#166534',
          blue: '#1d4ed8',
          purple: '#5b21b6',
          red: '#b91c1c',
          text: brandColors.text,
          muted: brandColors.muted,
          dim: brandColors.dim,
        },
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-fraunces)', 'Georgia', 'serif'],
      },
      /** One easing and pace for every hover and state change (brandMotion). */
      transitionTimingFunction: {
        DEFAULT: brandMotion.easeCss,
        out: brandMotion.easeCss,
      },
      transitionDuration: {
        DEFAULT: `${brandMotion.durationMs}ms`,
      },
    },
  },
  plugins: [],
}
export default config
