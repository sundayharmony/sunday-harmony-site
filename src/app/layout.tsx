import type { Metadata, Viewport } from 'next'
import { Montserrat } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import '@/styles/globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
})

export const metadata: Metadata = {
  title: 'Sunday Harmony | Your All-in-One Marketing Partner',
  description:
    'Sunday Harmony helps businesses stop guessing at marketing and start growing. Social media, SEO, Google Ads, and more — one partner who handles it all.',
  keywords:
    'marketing agency, business marketing, local SEO, social media management, Google Ads',
  openGraph: {
    title: 'Sunday Harmony | Your All-in-One Marketing Partner',
    description:
      'We help businesses get found online, generate leads, and grow revenue.',
    url: 'https://www.sundayharmony.com',
    siteName: 'Sunday Harmony',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sunday Harmony | All-in-One Marketing Partner',
    description:
      'Stop guessing at marketing. Start growing. All-in-one marketing for businesses.',
  },
  robots: 'index, follow',
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
  return (
    <html lang="en" className={montserrat.variable}>
      <body className={`${montserrat.className} font-sans antialiased`}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
