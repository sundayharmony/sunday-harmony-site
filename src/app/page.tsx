import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import HarmonyPaths from '@/components/HarmonyPaths'
import Services from '@/components/Services'
import CampaignAdBanner from '@/components/CampaignAdBanner'
import Packages from '@/components/Packages'
import Process from '@/components/Process'
import CtaBanner from '@/components/CtaBanner'
import Footer from '@/components/Footer'
import Divider from '@/components/Divider'
import { getCampaignAd, HOMEPAGE_CREDIT_AD_ID, HOMEPAGE_MID_AD_ID } from '@/lib/campaign-ads'

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main">
        <Hero />
        <HarmonyPaths />
        <Services />
        <CampaignAdBanner ad={getCampaignAd(HOMEPAGE_MID_AD_ID)} />
        <Divider />
        <Packages />
        <Divider />
        <Process />
        <CampaignAdBanner ad={getCampaignAd(HOMEPAGE_CREDIT_AD_ID)} />
        <CtaBanner />
      </main>
      <Footer />
    </>
  )
}
