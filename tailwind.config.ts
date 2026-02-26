import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#ffffff',
          'bg-soft': '#fafaf8',
          card: 'rgba(0,0,0,0.02)',
          'card-hover': 'rgba(0,0,0,0.04)',
          border: '#e8e5df',
          gold: '#b8943f',
          'gold-light': '#d4b96a',
          green: '#2d8a62',
          blue: '#2e7bb5',
          purple: '#6354b5',
          red: '#c94a42',
          text: '#1a1a2e',
          muted: '#6b7280',
          dim: '#9ca3af',
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'Helvetica Neue', 'Arial', 'sans-serif'],
        serif: ['Montserrat', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
