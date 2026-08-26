import type { Metadata } from 'next'
import Image from 'next/image'
import { Suspense } from 'react'
import PublicPageLayout from '@/components/layout/PublicPageLayout'
import CreditFundingForm from '@/components/credit-funding/CreditFundingForm'

export const metadata: Metadata = {
  title: 'Credit & Funding',
  description:
    'Apply for credit repair and funding assistance with Sunday Harmony. Secure multi-step intake for personal and business funding goals.',
  referrer: 'no-referrer',
  alternates: { canonical: '/credit-funding' },
  openGraph: {
    title: 'Credit & Funding | Sunday Harmony',
    description:
      'Apply for credit repair and funding assistance with Sunday Harmony. Secure multi-step intake for personal and business funding goals.',
    url: '/credit-funding',
  },
}

export default function CreditFundingPage() {
  return (
    <PublicPageLayout
      maxWidthClass="max-w-[800px]"
      label="Credit & Funding"
      title={
        <>
          Credit Repair &amp; <span className="gold-text">Funding Application</span>
        </>
      }
      description="Complete this secure intake form so our team can review your credit profile, verify your identity, and help you pursue your funding goals. All submissions are encrypted and handled confidentially."
      minimalHeader
      hero={
        <div className="mb-10 rounded-2xl overflow-hidden shadow-sm border border-brand-border">
          <Image
            src="/credit-score-hero.png"
            alt="Credit Score Improvement"
            width={800}
            height={450}
            className="w-full h-auto"
            priority
          />
        </div>
      }
    >
      <Suspense fallback={<p className="text-sm text-brand-muted">Loading application form…</p>}>
        <CreditFundingForm />
      </Suspense>
    </PublicPageLayout>
  )
}
