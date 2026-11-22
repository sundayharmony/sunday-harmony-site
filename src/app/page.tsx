import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import HomeIndex from '@/components/home/HomeIndex'
import HomeMotion from '@/components/home/HomeMotion'
import HarmonyPaths from '@/components/HarmonyPaths'
import Services from '@/components/Services'
import CampaignAdBanner from '@/components/CampaignAdBanner'
import Process from '@/components/Process'
import CtaBanner from '@/components/CtaBanner'
import Footer from '@/components/Footer'
import { getCampaignAd, HOMEPAGE_CREDIT_AD_ID, HOMEPAGE_MID_AD_ID } from '@/lib/campaign-ads'

export default function Home() {
  return (
    <>
      <Navbar />
      <HomeMotion>
        <main id="main">
          <Hero />
          <HomeIndex />
          <HarmonyPaths />
          <Services />
          <CampaignAdBanner ad={getCampaignAd(HOMEPAGE_MID_AD_ID)} />
          <Process />
          <CampaignAdBanner ad={getCampaignAd(HOMEPAGE_CREDIT_AD_ID)} />
          <div id="start">
            <CtaBanner />
          </div>
        </main>
      </HomeMotion>
      <Footer />
    </>
  )
}
