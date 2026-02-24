import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0a0a0f',
          card: 'rgba(255,255,255,0.03)',
          'card-hover': 'rgba(255,255,255,0.06)',
          border: 'rgba(255,255,255,0.06)',
          gold: '#c9a96e',
          'gold-light': '#e8d5a8',
          green: '#4a9e7d',
          blue: '#3a8bc2',
          purple: '#7b68c9',
          red: '#d4564e',
          text: '#e8e6e1',
          muted: '#9a9aaa',
          dim: '#6a6a7a',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'Helvetica Neue', 'Arial', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
export default config
