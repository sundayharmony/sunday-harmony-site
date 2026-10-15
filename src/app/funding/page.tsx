import type { Metadata } from 'next'
import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import CreditFundingForm from '@/components/credit-funding/CreditFundingForm'
import FundingHeroVisual from '@/components/funding/FundingHeroVisual'
import FundingReadiness from '@/components/funding/FundingReadiness'

export const metadata: Metadata = {
  title: 'Business Funding',
  description:
    'How business funding works, what lenders look at, and a secure intake for the business side of your request.',
  alternates: { canonical: '/funding' },
  openGraph: {
    title: 'Business Funding | Sunday Harmony',
    description:
      'Learn what lenders look at, check your readiness, and start a business funding intake with Sunday Harmony.',
    url: '/funding',
  },
}

const lookFor = [
  {
    number: '01',
    icon: '🏪',
    title: 'Time in business',
    body: 'How long the doors have been open, and the entity type, changes which programs are realistic.',
  },
  {
    number: '02',
    icon: '📈',
    title: 'Revenue and cash flow',
    body: 'Deposits, a profit and loss, and bank statements show whether the business can carry new capital.',
  },
  {
    number: '03',
    icon: '🎯',
    title: 'What the money is for',
    body: 'Equipment, payroll, inventory, and expansion are reviewed differently. A clear purpose is part of the file.',
  },
  {
    number: '04',
    icon: '🧾',
    title: 'The owner profile',
    body: 'Many small-business programs also look at the owner. That is a separate step from this business intake.',
  },
]

const options = [
  {
    icon: '🏦',
    title: 'Term loan',
    body: 'A lump sum repaid on a fixed schedule.',
    best: 'Expansion and large one-time costs',
    speed: 3,
    cost: 2,
  },
  {
    icon: '🔄',
    title: 'Line of credit',
    body: 'Draw what you need, repay, and draw again.',
    best: 'Cash-flow gaps and recurring needs',
    speed: 3,
    cost: 3,
  },
  {
    icon: '🚜',
    title: 'Equipment financing',
    body: 'The equipment itself secures the loan.',
    best: 'Vehicles, tools, and machinery',
    speed: 3,
    cost: 2,
  },
  {
    icon: '🏛️',
    title: 'SBA-backed loan',
    body: 'Partly guaranteed by the government, with more paperwork.',
    best: 'Established businesses with a strong file',
    speed: 1,
    cost: 1,
  },
  {
    icon: '⚡',
    title: 'Working capital advance',
    body: 'Repaid from future sales. Quick, but usually the priciest.',
    best: 'Short-term, urgent needs',
    speed: 5,
    cost: 5,
  },
]

const steps = [
  { title: 'Share the business', body: 'Contact details, the amount, and a short business profile.' },
  { title: 'We review the file', body: 'Sunday Harmony reads the details and flags what is missing.' },
  { title: 'Close the gaps', body: 'Sort the documents and fixes that strengthen the request.' },
  { title: 'Choose the next step', body: 'Talk through options that fit. Nothing is promised up front.' },
]

const faqs = [
  {
    q: 'Does this form check my credit?',
    a: 'No. This business intake does not pull credit and does not ask for your Social Security number.',
  },
  {
    q: 'Is this a loan application?',
    a: 'No. It is an intake so Sunday Harmony can review the business. Funding decisions are made by lenders, and nothing here is a promise of approval.',
  },
  {
    q: 'Do I need documents right now?',
    a: 'No. Uploads are optional. Articles, bank statements, or a tax return help, and you can add them later.',
  },
  {
    q: 'My business is new. Can I still submit?',
    a: 'Yes. Time in business affects which options are realistic, and part of the review is showing what to build toward.',
  },
]

function DotMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-dim">{label}</span>
      <span className="flex gap-1" role="img" aria-label={`${label} ${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((dot) => (
          <span
            key={dot}
            className={`h-2 w-5 rounded-full ${dot <= value ? 'bg-accent' : 'bg-neutral-200'}`}
          />
        ))}
      </span>
    </div>
  )
}

export default function FundingPage() {
  return (
    <>
      <Navbar />
      <main id="main" className="pt-[var(--nav-total-height)]">
        <section className="relative overflow-hidden bg-gradient-to-br from-white via-neutral-50 to-neutral-100">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
          <div className="absolute -top-1/3 -right-1/6 w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(184,148,63,0.12)_0%,transparent_70%)] pointer-events-none" />
          <div className="relative z-10 max-w-[1180px] mx-auto px-7 py-16 sm:py-20 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-soft border border-brand-border text-xs font-semibold text-accent tracking-wide mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Business funding
              </div>
              <h1 className="font-serif text-[clamp(40px,6vw,66px)] font-extrabold leading-[1.03] text-brand-text mb-6">
                Fund the business.
                <span className="block mt-1 italic text-accent">Fuel the next stage.</span>
              </h1>
              <p className="text-lg text-brand-muted leading-relaxed mb-9 max-w-[540px]">
                A plain-English look at how business funding works and what reviewers look at, then a short intake when you are ready. Not a loan approval, and not a credit-repair application.
              </p>
              <div className="flex gap-3.5 flex-wrap mb-8">
                <a
                  href="#intake"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-brand-text text-white text-sm font-semibold hover:-translate-y-0.5 hover:bg-neutral-800 transition-all"
                >
                  Start the intake →
                </a>
                <a
                  href="#readiness"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg border border-brand-border text-brand-text text-sm font-semibold bg-white/80 backdrop-blur-sm hover:bg-neutral-50 transition-all"
                >
                  Check your readiness
                </a>
                <a
                  href="/partners/signup"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg border border-brand-border text-brand-text text-sm font-semibold bg-white/80 backdrop-blur-sm hover:bg-neutral-50 transition-all"
                >
                  Sign up as a partner
                </a>
              </div>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-muted">
                {['No Social Security number', 'Documents optional', 'Review before any next step'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft border border-brand-border text-[11px] font-bold text-accent" aria-hidden>
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute -top-6 -left-6 h-24 w-24 rounded-full border border-brand-border bg-white/80 backdrop-blur-md" />
              <div className="absolute -bottom-8 -right-4 h-20 w-20 rounded-full border border-brand-border bg-white/80 backdrop-blur-md" />
              <div className="relative">
                <FundingHeroVisual />
              </div>
              <span className="sr-only">
                Decorative illustration: stacks of coins rising like stairs toward a milestone flag, with icons for approval, timing, paperwork, and a storefront.
              </span>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white" id="look-for">
          <div className="max-w-[1100px] mx-auto px-7">
            <div className="section-label">What reviewers look at</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,48px)] font-extrabold leading-[1.1] text-brand-text mb-12 max-w-[640px]">
              Four things shape <span className="gold-text">almost every request</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {lookFor.map((item) => (
                <article
                  key={item.title}
                  className="group relative overflow-hidden rounded-2xl border border-brand-border bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-md hover:border-accent"
                >
                  <span
                    className="absolute -top-3 -right-1 font-serif text-[84px] font-extrabold leading-none text-accent/10 transition-colors group-hover:text-accent/20"
                    aria-hidden
                  >
                    {item.number}
                  </span>
                  <div className="relative">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-border bg-accent-soft text-[22px]">
                      {item.icon}
                    </div>
                    <h3 className="text-lg font-bold text-brand-text mb-2">{item.title}</h3>
                    <p className="text-sm text-brand-muted leading-relaxed">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-brand-bg-soft" id="options">
          <div className="max-w-[1100px] mx-auto px-7">
            <div className="section-label">Funding options</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,48px)] font-extrabold leading-[1.1] text-brand-text mb-4 max-w-[680px]">
              The right fit depends on <span className="gold-text">speed, cost, and purpose</span>
            </h2>
            <p className="text-[15px] text-brand-muted leading-relaxed mb-12 max-w-[600px]">
              Faster usually costs more. Cheaper usually asks for a stronger file and more patience. Here is how the common options compare.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {options.map((option) => (
                <article
                  key={option.title}
                  className="rounded-2xl border border-brand-border bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand-border bg-accent-soft text-[22px]">
                      {option.icon}
                    </div>
                    <h3 className="text-lg font-bold text-brand-text leading-tight">{option.title}</h3>
                  </div>
                  <p className="text-sm text-brand-muted leading-relaxed mb-4">{option.body}</p>
                  <div className="mb-5 rounded-lg bg-neutral-50 border border-brand-border px-3 py-2 text-xs text-brand-muted">
                    <span className="font-semibold text-brand-text">Best for: </span>
                    {option.best}
                  </div>
                  <div className="space-y-2.5">
                    <DotMeter label="Speed" value={option.speed} />
                    <DotMeter label="Cost" value={option.cost} />
                  </div>
                </article>
              ))}
              <div className="rounded-2xl border border-dashed border-accent/50 bg-accent-soft/60 p-7 flex flex-col justify-center">
                <p className="font-serif text-xl font-bold text-brand-text mb-2">Not sure which fits?</p>
                <p className="text-sm text-brand-muted leading-relaxed mb-4">
                  Start the intake. Sunday Harmony reviews the business and talks the options through with you.
                </p>
                <a href="#intake" className="text-sm font-semibold text-accent hover:underline">
                  Go to the intake →
                </a>
              </div>
            </div>
            <p className="mt-6 text-xs text-brand-dim">
              General education about typical patterns. Terms vary by lender, and nothing here is an offer.
            </p>
          </div>
        </section>

        <section className="py-20 bg-white" id="readiness">
          <div className="max-w-[1000px] mx-auto px-7">
            <div className="section-label">Readiness check</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,48px)] font-extrabold leading-[1.1] text-brand-text mb-4 max-w-[640px]">
              How ready is <span className="gold-text">the file today?</span>
            </h2>
            <p className="text-[15px] text-brand-muted leading-relaxed mb-10 max-w-[560px]">
              Tick what is true. This stays on your screen and is not submitted. It is a quick way to see what to line up first.
            </p>
            <FundingReadiness />
          </div>
        </section>

        <section className="relative overflow-hidden py-24 bg-brand-text text-white" id="how">
          <div className="absolute -top-40 -right-32 w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(184,148,63,0.22)_0%,transparent_70%)] pointer-events-none" />
          <div className="relative max-w-[1100px] mx-auto px-7">
            <div className="section-label">How it works</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,48px)] font-extrabold leading-[1.1] mb-16 max-w-[640px]">
              From first details to <span className="italic text-accent">a clear next step</span>
            </h2>
            <ol className="relative grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6">
              <div
                className="hidden md:block absolute left-[6%] right-[6%] top-[27px] border-t border-dashed border-white/25"
                aria-hidden
              />
              {steps.map((step, index) => (
                <li key={step.title} className="relative">
                  <div className="relative z-10 mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-accent bg-brand-text font-serif text-xl font-extrabold text-accent">
                    {index + 1}
                  </div>
                  <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                  <p className="text-sm text-white/65 leading-relaxed">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="py-20 bg-white" id="faq">
          <div className="max-w-[820px] mx-auto px-7">
            <div className="section-label">Good to know</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,44px)] font-extrabold leading-[1.1] text-brand-text mb-10">
              Quick answers
            </h2>
            <div className="space-y-3">
              {faqs.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-2xl border border-brand-border bg-white px-6 py-5 transition-colors open:border-accent open:bg-accent-soft/40"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-brand-text [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-border bg-white text-lg leading-none text-accent transition-transform group-open:rotate-45"
                      aria-hidden
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-brand-muted leading-relaxed pr-10">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-brand-bg-soft border-t border-brand-border" id="intake">
          <div className="max-w-[800px] mx-auto px-7">
            <div className="section-label">Business intake</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,46px)] font-extrabold leading-[1.1] text-brand-text mb-3">
              Start the <span className="gold-text">business intake</span>
            </h2>
            <p className="text-[15px] text-brand-muted leading-relaxed mb-10 max-w-[600px]">
              Contact, the amount you are seeking, and the business profile. Personal credit reports are not part of this form.
            </p>
            <Suspense fallback={<p className="text-sm text-brand-muted">Loading application form…</p>}>
              <CreditFundingForm variant="funding" />
            </Suspense>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
