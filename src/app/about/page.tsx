import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import About from '@/components/About'
import PartnerLogos from '@/components/PartnerLogos'
import CtaBanner from '@/components/CtaBanner'
import { listPublicPartnerLogos } from '@/lib/partner-logos'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Sunday Harmony helps business owners clarify their brand, decide what to do next, and put systems in place so the business can run with a plan.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About | Sunday Harmony',
    description:
      'Learn how Sunday Harmony partners with business owners on brand, strategy, and systems—with plain English and no runaround.',
    url: '/about',
  },
}

export default async function AboutPage() {
  const logos = await listPublicPartnerLogos()
  return (
    <>
      <Navbar />
      <main id="main" className="pt-[var(--nav-total-height)]">
        <About />
        <PartnerLogos logos={logos} />
        <CtaBanner />
      </main>
      <Footer />
    </>
  )
}
