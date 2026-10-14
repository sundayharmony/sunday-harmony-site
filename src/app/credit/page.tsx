import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import CreditFundingForm from '@/components/credit-funding/CreditFundingForm'
import CreditHeroVisual from '@/components/credit/CreditHeroVisual'
import CreditReadiness from '@/components/credit/CreditReadiness'
import { CREDIT_INTAKE_PATH } from '@/lib/credit-intake-routes'
import { normalizeReferralCode, safeReferralLandingPath } from '@/lib/referrals'

export const metadata: Metadata = {
  title: 'Personal Credit',
  description:
    'Learn what shapes your credit score, check your readiness, and start a secure intake for analysis and repair with Sunday Harmony.',
  referrer: 'no-referrer',
  alternates: { canonical: CREDIT_INTAKE_PATH },
  openGraph: {
    title: 'Personal Credit | Sunday Harmony',
    description:
      'Educational guide to credit scores and disputes, plus a secure intake when you are ready.',
    url: CREDIT_INTAKE_PATH,
  },
}

const scoreFactors = [
  {
    number: '01',
    icon: '⏱',
    title: 'Payment history',
    body: 'On-time payments matter most. Late marks, charge-offs, and collections weigh heavily—and age over time.',
    weight: 5,
  },
  {
    number: '02',
    icon: '💳',
    title: 'Amounts owed',
    body: 'High balances on cards hurt even when you pay on time. Utilization across cards is a common quick win.',
    weight: 4,
  },
  {
    number: '03',
    icon: '📅',
    title: 'Length of history',
    body: 'Older accounts in good standing help. Closing old cards can shorten your average age.',
    weight: 3,
  },
  {
    number: '04',
    icon: '🔀',
    title: 'Credit mix',
    body: 'A healthy mix of installment and revolving accounts can help—only open what you will actually use.',
    weight: 2,
  },
  {
    number: '05',
    icon: '🔍',
    title: 'New inquiries',
    body: 'Hard pulls from applications can ding scores briefly. Rate shopping for a mortgage or auto is often grouped.',
    weight: 2,
  },
]

const approaches = [
  {
    icon: '📊',
    title: 'Read the file',
    body: 'We line up all three bureaus, flag errors, and show what is helping or hurting today.',
    best: 'Anyone who wants clarity before disputing',
  },
  {
    icon: '✉️',
    title: 'Dispute with a plan',
    body: 'Round-by-round letters, furnishers, and escalations when items are inaccurate or unverifiable.',
    best: 'Inaccurate negatives and mixed files',
  },
  {
    icon: '📈',
    title: 'Build toward funding',
    body: 'Personal credit often gates business funding. We can work both sides when that is the goal.',
    best: 'Owners preparing for a funding request',
  },
]

const steps = [
  { title: 'Secure intake', body: 'Identity, goals, and monitoring access so we can see the same data you do.' },
  { title: 'Analysis', body: 'Sunday Harmony maps scores, negatives, and inquiries across bureaus.' },
  { title: 'Action plan', body: 'Disputes, paydown priorities, and habits—plain language, no hype.' },
  { title: 'Track progress', body: 'Client portal updates, rounds, and next steps as the file changes.' },
]

const faqs = [
  {
    q: 'Is this a guarantee to raise my score?',
    a: 'No. We follow the law and dispute inaccurate or unverifiable items. Results depend on your file and how furnishers respond.',
  },
  {
    q: 'Do I need a 3-bureau report before I apply?',
    a: 'No. Many clients use a monitoring service we connect to during intake. You can upload reports if you already have them.',
  },
  {
    q: 'How is this different from business funding?',
    a: 'Personal credit is about your consumer report. Business funding uses entity revenue and bank data—see our funding page for that path.',
  },
  {
    q: 'Is my information secure?',
    a: 'Yes. Sensitive fields are encrypted, uploads are validated, and access is limited to staff who need it. See our privacy policy for details.',
  },
]

function WeightMeter({ value }: { value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-dim">Typical impact</span>
      <span className="flex gap-1" role="img" aria-label={`Typical impact ${value} out of 5`}>
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

export default async function CreditPage({
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
    const nextPath = safeReferralLandingPath(qs ? `${CREDIT_INTAKE_PATH}?${qs}` : CREDIT_INTAKE_PATH)
    redirect(`/api/referrals/track?code=${encodeURIComponent(code)}&next=${encodeURIComponent(nextPath)}`)
  }

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
                Personal credit
              </div>
              <h1 className="font-serif text-[clamp(40px,6vw,66px)] font-extrabold leading-[1.03] text-brand-text mb-6">
                Strengthen your credit.
                <span className="block mt-1 italic text-accent">Know the file first.</span>
              </h1>
              <p className="text-lg text-brand-muted leading-relaxed mb-9 max-w-[540px]">
                A plain-English look at what shapes your score, what disputes can (and cannot) do, and a secure intake when you are ready for Sunday Harmony to review your profile.
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
              </div>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-muted">
                {['Encrypted intake', 'All three bureaus', 'No score guarantees'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft border border-brand-border text-[11px] font-bold text-accent"
                      aria-hidden
                    >
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
                <CreditHeroVisual />
              </div>
              <span className="sr-only">
                Decorative illustration: a credit score arc, bureau report pillars, and icons for documents, trends, and verification.
              </span>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white" id="factors">
          <div className="max-w-[1100px] mx-auto px-7">
            <div className="section-label">What shapes your score</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,48px)] font-extrabold leading-[1.1] text-brand-text mb-4 max-w-[680px]">
              Five factors drive <span className="gold-text">most scoring models</span>
            </h2>
            <p className="text-[15px] text-brand-muted leading-relaxed mb-12 max-w-[600px]">
              Exact formulas vary by bureau and model, but these themes show up again and again. Your audit prioritizes the levers that matter for your file.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {scoreFactors.map((item) => (
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
                    <p className="text-sm text-brand-muted leading-relaxed mb-4">{item.body}</p>
                    <WeightMeter value={item.weight} />
                  </div>
                </article>
              ))}
              <div className="rounded-2xl border border-dashed border-accent/50 bg-accent-soft/60 p-7 flex flex-col justify-center">
                <p className="font-serif text-xl font-bold text-brand-text mb-2">Need business funding instead?</p>
                <p className="text-sm text-brand-muted leading-relaxed mb-4">
                  Entity revenue, bank statements, and use of funds live on a separate intake.
                </p>
                <a href="/funding" className="text-sm font-semibold text-accent hover:underline">
                  Go to business funding →
                </a>
              </div>
            </div>
            <p className="mt-6 text-xs text-brand-dim">
              Educational summary only—not credit counseling or legal advice.
            </p>
          </div>
        </section>

        <section className="py-20 bg-brand-bg-soft" id="approach">
          <div className="max-w-[1100px] mx-auto px-7">
            <div className="section-label">How we help</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,48px)] font-extrabold leading-[1.1] text-brand-text mb-12 max-w-[640px]">
              Clarity first, <span className="gold-text">then action</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {approaches.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-brand-border bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand-border bg-accent-soft text-[22px]">
                      {item.icon}
                    </div>
                    <h3 className="text-lg font-bold text-brand-text leading-tight">{item.title}</h3>
                  </div>
                  <p className="text-sm text-brand-muted leading-relaxed mb-4">{item.body}</p>
                  <div className="rounded-lg bg-neutral-50 border border-brand-border px-3 py-2 text-xs text-brand-muted">
                    <span className="font-semibold text-brand-text">Best for: </span>
                    {item.best}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-white" id="readiness">
          <div className="max-w-[1000px] mx-auto px-7">
            <div className="section-label">Readiness check</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,48px)] font-extrabold leading-[1.1] text-brand-text mb-4 max-w-[640px]">
              How ready is <span className="gold-text">your file today?</span>
            </h2>
            <p className="text-[15px] text-brand-muted leading-relaxed mb-10 max-w-[560px]">
              Tick what is true. This stays on your screen and is not submitted—it is a quick gut-check before the intake.
            </p>
            <CreditReadiness />
          </div>
        </section>

        <section className="relative overflow-hidden py-24 bg-brand-text text-white" id="how">
          <div className="absolute -top-40 -right-32 w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(184,148,63,0.22)_0%,transparent_70%)] pointer-events-none" />
          <div className="relative max-w-[1100px] mx-auto px-7">
            <div className="section-label">How it works</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,48px)] font-extrabold leading-[1.1] mb-16 max-w-[640px]">
              From intake to <span className="italic text-accent">a clearer file</span>
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

        <section className="py-20 bg-brand-bg-soft" id="faq">
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

        <section className="py-20 bg-white border-t border-brand-border" id="intake">
          <div className="max-w-[800px] mx-auto px-7">
            <div className="section-label">Secure intake</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,46px)] font-extrabold leading-[1.1] text-brand-text mb-3">
              Start your <span className="gold-text">credit intake</span>
            </h2>
            <p className="text-[15px] text-brand-muted leading-relaxed mb-10 max-w-[600px]">
              Personal information, identity documents, and credit monitoring access. Submissions are encrypted and reviewed confidentially.
            </p>
            <Suspense fallback={<p className="text-sm text-brand-muted">Loading application form…</p>}>
              <CreditFundingForm variant="credit" />
            </Suspense>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
