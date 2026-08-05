import { ImageResponse } from 'next/og'
import { siteConfig } from '@/lib/data'

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(145deg, #0a0a0a 0%, #1a1a1a 55%, #2a2418 100%)',
          color: '#ffffff',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: '#b8943f',
            textTransform: 'uppercase',
          }}
        >
          {siteConfig.name}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {siteConfig.tagline}
          </div>
          <div style={{ fontSize: 28, color: '#d4d4d4', lineHeight: 1.35, maxWidth: 820 }}>
            Social media, SEO, Google Ads, and more — one partner who handles it all.
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 22, color: '#a3a3a3' }}>
          www.sundayharmony.com
        </div>
      </div>
    ),
    { ...size }
  )
}
