import type { Config } from 'tailwindcss'

/**
 * Monochrome base + single accent.
 * Change `accent.DEFAULT` and `accent.soft` together (and :root in globals.css) to rebrand.
 */
const ACCENT = '#b8943f'
const ACCENT_SOFT = '#f0ebe3'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: ACCENT,
          soft: ACCENT_SOFT,
          foreground: '#0a0a0a',
        },
        brand: {
          bg: '#ffffff',
          'bg-soft': '#fafafa',
          card: 'rgba(0, 0, 0, 0.02)',
          'card-hover': 'rgba(0, 0, 0, 0.05)',
          border: '#e5e5e5',
          /** @deprecated use text-accent / border-accent — kept for gradual migration */
          gold: ACCENT,
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
