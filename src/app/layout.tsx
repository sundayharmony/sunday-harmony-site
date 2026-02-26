import type { Metadata } from 'next'
import { DM_Sans, Playfair_Display } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import '@/styles/globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sunday Harmony | Marketing Agency for NJ Small Businesses',
  description:
    "Sunday Harmony helps NJ small businesses stop guessing at marketing and start growing. Social media, SEO, Google Ads, and more — one partner who handles it all.",
  keywords: 'NJ marketing agency, New Jersey small business marketing, local SEO NJ, social media management',
  openGraph: {
    title: "Sunday Harmony | NJ's All-in-One Marketing Partner",
    description: 'We help NJ small businesses get found online, generate leads, and grow revenue.',
    url: 'https://www.sundayharmony.com',
    siteName: 'Sunday Harmony',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sunday Harmony | NJ Marketing Agency',
    description: 'Stop guessing at marketing. Start growing. All-in-one marketing for NJ small businesses.',
  },
  robots: 'index, follow',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <body className="font-sans">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
