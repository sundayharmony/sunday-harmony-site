import dynamic from 'next/dynamic'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import Services from '@/components/Services'
import CampaignAdBanner from '@/components/CampaignAdBanner'
import Packages from '@/components/Packages'
import Process from '@/components/Process'
import About from '@/components/About'
import CtaBanner from '@/components/CtaBanner'
import Footer from '@/components/Footer'
import Divider from '@/components/Divider'
import { getCampaignAd, HOMEPAGE_MID_AD_ID } from '@/lib/campaign-ads'

const ContactForm = dynamic(() => import('@/components/ContactForm'), {
  loading: () => (
    <section className="py-24 pt-8" id="contact" aria-busy="true">
      <div className="max-w-[1100px] mx-auto px-7 py-16 text-center text-sm text-brand-muted">Loading form…</div>
    </section>
  ),
})

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main">
        <Hero />
        <Services />
        <CampaignAdBanner ad={getCampaignAd(HOMEPAGE_MID_AD_ID)} />
        <Divider />
        <Packages />
        <Divider />
        <Process />
        <Divider />
        <About />
        <CtaBanner />
        <ContactForm />
      </main>
      <Footer />
    </>
  )
}
