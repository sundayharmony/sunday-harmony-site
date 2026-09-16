import type { Metadata } from 'next'
import Image from 'next/image'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import PublicPageLayout from '@/components/layout/PublicPageLayout'
import CreditFundingForm from '@/components/credit-funding/CreditFundingForm'
import { normalizeReferralCode, safeReferralLandingPath } from '@/lib/referrals'

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

export default async function CreditFundingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; invite?: string }>
}) {
  const params = await searchParams
  const code = normalizeReferralCode(params.ref)
  if (code) {
    const nextParams = new URLSearchParams()
    if (params.invite?.trim()) nextParams.set('invite', params.invite.trim())
    const qs = nextParams.toString()
    const nextPath = safeReferralLandingPath(qs ? `/credit-funding?${qs}` : '/credit-funding')
    redirect(`/api/referrals/track?code=${encodeURIComponent(code)}&next=${encodeURIComponent(nextPath)}`)
  }
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
