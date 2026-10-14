import type { Metadata } from 'next'
import { Suspense } from 'react'
import PublicPageLayout from '@/components/layout/PublicPageLayout'
import CreditFundingForm from '@/components/credit-funding/CreditFundingForm'

export const metadata: Metadata = {
  title: 'Business Funding',
  description:
    'How Sunday Harmony helps business owners prepare for funding, and a secure intake for the business side of your request.',
  alternates: { canonical: '/funding' },
  openGraph: {
    title: 'Business Funding | Sunday Harmony',
    description:
      'Learn what lenders look at, what to have ready, and start a business funding intake with Sunday Harmony.',
    url: '/funding',
  },
}

const topics = [
  {
    title: 'Time in business and entity',
    body: 'How long the company has been open, and whether it is an LLC, corporation, or sole prop, changes which programs are realistic.',
  },
  {
    title: 'Revenue and cash flow',
    body: 'Recent deposits, a profit and loss, and bank statements show whether the business can carry new capital.',
  },
  {
    title: 'What the money is for',
    body: 'Equipment, payroll, inventory, and expansion are reviewed differently. A clear purpose is part of the file.',
  },
  {
    title: 'Personal credit, when it matters',
    body: 'Many small-business programs still look at the owner. That review happens separately from this business intake.',
  },
]

export default function FundingPage() {
  return (
    <PublicPageLayout
      maxWidthClass="max-w-[860px]"
      label="Business funding"
      title={
        <>
          Fund the <span className="gold-text">business</span>
        </>
      }
      description="A clear look at how business funding works, then the business details we need to review a request. This is not a loan approval and not a credit-repair application."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
        {topics.map((topic) => (
          <article key={topic.title} className="rounded-2xl border border-brand-border bg-white p-6">
            <h2 className="font-serif text-xl font-bold text-brand-text mb-2">{topic.title}</h2>
            <p className="text-sm text-brand-muted leading-relaxed">{topic.body}</p>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-brand-border bg-white p-6 sm:p-8 mb-12">
        <h2 className="font-serif text-2xl font-bold text-brand-text mb-3">What to have nearby</h2>
        <ul className="space-y-2 text-sm text-brand-muted leading-relaxed list-disc pl-5">
          <li>Legal name and the month and year the business opened</li>
          <li>A rough amount and when you need the funds</li>
          <li>Articles, recent bank statements, or a tax return if you have them</li>
        </ul>
        <p className="mt-4 text-sm text-brand-dim leading-relaxed">
          Documents are optional on this form. You can add them now or later. Sunday Harmony reviews the file and follows up. Nothing here is a promise of funding.
        </p>
      </section>

      <section id="intake">
        <h2 className="font-serif text-[clamp(28px,4vw,40px)] font-extrabold text-brand-text mb-2">Start the business intake</h2>
        <p className="text-sm text-brand-muted mb-8 max-w-[640px] leading-relaxed">
          Contact, the amount you are seeking, and the business profile. Personal credit reports are not part of this form.
        </p>
        <Suspense fallback={<p className="text-sm text-brand-muted">Loading application form…</p>}>
          <CreditFundingForm variant="funding" />
        </Suspense>
      </section>
    </PublicPageLayout>
  )
}
