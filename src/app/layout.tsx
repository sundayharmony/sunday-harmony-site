import type { Metadata, Viewport } from 'next'
import { Montserrat } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { siteConfig } from '@/lib/data'
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_DESCRIPTION,
  DEFAULT_TITLE,
  getSiteUrl,
  organizationJsonLd,
  websiteJsonLd,
} from '@/lib/seo'
import '@/styles/globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${siteConfig.name}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords:
    'business consulting, brand strategy, business systems, local SEO, social media management, business funding, credit analysis',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_OG_DESCRIPTION,
    url: '/',
    siteName: siteConfig.name,
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} | ${siteConfig.tagline}`,
    description:
      'Stop guessing. Start growing with a clear strategy for the brand, the plan, and the systems a business runs on.',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-48x48.png', type: 'image/png', sizes: '48x48' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const jsonLd = [organizationJsonLd(), websiteJsonLd()]

  return (
    <html lang="en" className={montserrat.variable}>
      <body className={`${montserrat.className} font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
