import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import FundingAppForm from '@/components/funding/FundingAppForm'
import { FUNDING_APP_PATH } from '@/lib/fundingapp-fields'

export const metadata: Metadata = {
  title: 'Funding Application',
  description: 'Apply for credit and funding with Sunday Harmony.',
  referrer: 'no-referrer',
  alternates: { canonical: FUNDING_APP_PATH },
  openGraph: {
    title: 'Funding Application | Sunday Harmony',
    description: 'Apply for credit and funding with Sunday Harmony.',
    url: FUNDING_APP_PATH,
  },
}

export default function FundingAppPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="bg-brand-bg-soft py-16 sm:py-20" id="intake">
          <div className="max-w-[800px] mx-auto px-7">
            <div className="section-label">Secure intake</div>
            <h1 className="font-serif text-[clamp(30px,4.6vw,46px)] font-extrabold leading-[1.1] text-brand-text mb-3">
              Start your <span className="gold-text">funding application</span>
            </h1>
            <p className="text-[15px] text-brand-muted leading-relaxed mb-10 max-w-[600px]">
              Tell us what you need and share the Experian login for your consultation. Submissions are encrypted and reviewed confidentially.
            </p>
            <FundingAppForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
