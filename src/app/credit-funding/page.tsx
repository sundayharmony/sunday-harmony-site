import type { Metadata } from 'next'
import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import CreditFundingForm from '@/components/credit-funding/CreditFundingForm'

export const metadata: Metadata = {
  title: 'Credit & Funding | Sunday Harmony',
  description:
    'Apply for credit repair and funding assistance with Sunday Harmony. Secure multi-step intake for personal and business funding goals.',
}

export default function CreditFundingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[72px] min-h-screen bg-brand-bg-soft">
        <section className="py-16 sm:py-20">
          <div className="max-w-[800px] mx-auto px-7">
            <div className="section-label">Credit &amp; Funding</div>
            <h1 className="font-serif text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.12] text-brand-text mb-4">
              Credit Repair &amp; <span className="gold-text">Funding Application</span>
            </h1>
            <p className="text-[15px] text-brand-muted mb-10 leading-relaxed max-w-[600px]">
              Complete this secure intake form so our team can review your credit profile, verify your identity, and help you pursue your funding goals. All submissions are encrypted and handled confidentially.
            </p>
            <Suspense fallback={<p className="text-sm text-brand-muted">Loading application form…</p>}>
              <CreditFundingForm />
            </Suspense>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
