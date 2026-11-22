import type { Config } from 'tailwindcss'
import { brandColors } from './src/lib/brand-tokens'

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
          foreground: '#0a0a0a',
        },
        brand: {
          bg: '#ffffff',
          'bg-soft': '#fafafa',
          card: 'rgba(0, 0, 0, 0.02)',
          'card-hover': 'rgba(0, 0, 0, 0.05)',
          border: '#e5e5e5',
          /** @deprecated use text-accent / border-accent — kept for gradual migration */
          gold: brandColors.accent,
          'gold-light': '#c4a052',
          /** Subdued semantic (admin badges, alerts) */
          green: '#166534',
          blue: '#1d4ed8',
          purple: '#5b21b6',
          red: '#b91c1c',
          text: '#0a0a0a',
          muted: '#525252',
          dim: '#a3a3a3',
        },
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-montserrat)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
