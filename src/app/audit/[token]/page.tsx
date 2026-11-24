import Link from 'next/link'
import { notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { loadAudit } from '@/lib/icp-audit-load'
import type { AuditArea, CheckStatus } from '@/lib/icp-audit-areas'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: Params) {
  const { token } = await params
  const found = await loadAudit(token).catch(() => null)
  return {
    title: found ? `${found.audit.business}: free online audit` : 'Free online audit',
    robots: { index: false, follow: false },
  }
}

const MARK: Record<CheckStatus, { sign: string; cls: string; sr: string }> = {
  pass: { sign: '✓', cls: 'bg-[#e7efe3] text-[#2f5d2a]', sr: 'Good' },
  fail: { sign: '✕', cls: 'bg-[#f6e3dc] text-[#8a3b22]', sr: 'Needs work' },
  unknown: { sign: '?', cls: 'bg-brand-border text-brand-muted', sr: 'Not checked' },
}

function scoreWord(score: number | null): string {
  if (score == null) return 'Not checked'
  if (score >= 80) return 'Strong'
  if (score >= 50) return 'Needs work'
  return 'Weak'
}

function AreaCard({ area, competitors }: { area: AuditArea; competitors: Array<{ name: string; rating: number | null; reviews: number | null }> }) {
  return (
    <li className="rounded-3xl border border-brand-border bg-brand-paper p-6 sm:p-7">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-serif text-xl sm:text-2xl font-semibold tracking-tight text-brand-text">{area.title}</h3>
        <p className="shrink-0 text-right">
          <span className="font-serif text-2xl font-semibold text-brand-text">{area.score ?? '–'}</span>
          <span className="text-sm text-brand-muted">/100 · {scoreWord(area.score)}</span>
        </p>
      </div>
      <ul className="mt-4 space-y-3">
        {area.checks.map((c) => (
          <li key={c.label} className="flex gap-3">
            <span aria-hidden className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${MARK[c.status].cls}`}>
              {MARK[c.status].sign}
            </span>
            <span className="leading-relaxed">
              <span className="sr-only">{MARK[c.status].sr}: </span>
              <span className="font-semibold text-brand-text">{c.label}</span>
              {c.note ? <span className="block text-sm text-brand-muted">{c.note}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {area.key === 'marketing' && competitors.length ? (
        <div className="mt-5 rounded-2xl border border-brand-border p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7f6427]">Nearby competitors on Google</p>
          <ul className="mt-2 space-y-1 text-sm">
            {competitors.map((c) => (
              <li key={c.name} className="flex justify-between gap-3">
                <span className="text-brand-text">{c.name}</span>
                <span className="shrink-0 text-brand-muted">{c.rating ?? '–'}★ · {c.reviews ?? 0} reviews</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {area.score != null && area.score < 70 ? (
        <p className="mt-5 border-t border-brand-border pt-4 text-sm text-brand-text">
          <span className="font-semibold">Fixed in {area.fixedBy}: </span>
          {area.why}
        </p>
      ) : null}
    </li>
  )
}

const pill = 'inline-flex min-h-[48px] items-center justify-center rounded-full px-7 text-sm font-semibold transition-all duration-500 ease-out'

export default async function AuditPage({ params }: Params) {
  const { token } = await params
  const found = await loadAudit(token).catch(() => null)
  if (!found) notFound()
  const { audit } = found

  return (
    <>
      <Navbar />
      <main id="main" className="pt-[var(--nav-total-height)] bg-brand-bg">
        <section className="py-14 sm:py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-7">
            <p className="section-label">Free online audit</p>
            <h1 className="font-serif text-4xl sm:text-5xl font-semibold tracking-tight text-brand-text">{audit.business}</h1>
            {audit.location ? <p className="mt-3 text-brand-muted">{audit.location}</p> : null}
            <p className="mt-6 text-brand-text leading-relaxed max-w-2xl">
              We checked your Google profile, website, branding, social media, marketing and systems the way a new customer
              would. Here is what is working, what is not, and how to fix it.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link href="/book" className={`${pill} bg-brand-text text-brand-bg hover:-translate-y-0.5`}>
                Book a free call
              </Link>
              <a href={`/audit/${encodeURIComponent(token)}/pdf`} className={`${pill} border border-brand-text text-brand-text hover:-translate-y-0.5`}>
                Download PDF
              </a>
            </div>

            {(audit.areas ? audit.strengths.filter((t) => !/^No major gaps/i.test(t)) : audit.strengths).length ? (
              <div className="mt-12">
                <p className="section-label">What is working</p>
                <ul className="space-y-2">
                  {(audit.areas ? audit.strengths.filter((t) => !/^No major gaps/i.test(t)) : audit.strengths).map((s) => (
                    <li key={s} className="text-brand-text leading-relaxed">{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {audit.areas ? (
              <div className="mt-12">
                <p className="section-label">Your online score</p>
                <p className="font-serif text-6xl font-semibold tracking-tight text-brand-text">
                  {audit.overall ?? '–'}
                  <span className="text-2xl text-brand-muted">/100</span>
                </p>
                <p className="mt-2 text-brand-muted leading-relaxed">
                  The average of the 6 areas below: your Google profile, website, branding, social media, marketing and systems.
                </p>
                <ul className="mt-8 space-y-4">
                  {audit.areas.map((area) => (
                    <AreaCard key={area.key} area={area} competitors={audit.competitors} />
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-12">
              <p className="section-label">What we found{audit.findings.length ? ` (${audit.findings.length})` : ''}</p>
              {audit.findings.length ? (
                <ol className="space-y-4">
                  {audit.findings.map((f, i) => (
                    <li key={f.title} className="rounded-3xl border border-brand-border bg-brand-paper p-6 sm:p-7">
                      <h2 className="font-serif text-xl sm:text-2xl font-semibold tracking-tight text-brand-text">
                        {i + 1}. {f.title}
                      </h2>
                      <p className="mt-2 text-brand-muted leading-relaxed">{f.detail}</p>
                      <p className="mt-3 text-brand-text leading-relaxed">
                        <span className="font-semibold">Fix: </span>
                        {f.fix}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-brand-text">No major gaps on your website or Google profile.</p>
              )}
            </div>
            )}
          </div>
        </section>

        <section className="bg-[#1b1a17] py-14 sm:py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-7">
            {audit.plan.length ? (
              <>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold">Your plan</p>
                <ol className="mt-4 space-y-6">
                  {audit.plan.map((step, i) => (
                    <li key={step.name}>
                      <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-[#fbf7f0]">
                        {i + 1}. {step.name}
                      </h2>
                      <p className="mt-1 text-sm uppercase tracking-[0.12em] text-brand-gold">Fixes: {step.areas.join(' · ')}</p>
                      <ul className="mt-2 space-y-1">
                        {step.why.map((w) => (
                          <li key={w} className="text-[#e6dbc6] leading-relaxed">{w}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold">Suggested next step</p>
                <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#fbf7f0]">{audit.nextStep.name}</h2>
                <p className="mt-3 text-[#e6dbc6] leading-relaxed max-w-2xl">{audit.nextStep.detail}</p>
              </>
            )}
            <p className="mt-3 text-[#e6dbc6] leading-relaxed max-w-2xl">
              Book a free 30-minute call and we will walk through this audit with you. No contract.
            </p>
            <Link href="/book" className={`${pill} mt-7 bg-brand-gold text-[#1b1a17] hover:-translate-y-0.5`}>
              Pick a time
            </Link>
            <p className="mt-4 text-sm text-[#e6dbc6]">
              Rather talk now? Call{' '}
              <a href="tel:+16094004459" className="font-semibold text-brand-gold underline-offset-4 hover:underline">
                (609) 400-4459
              </a>
            </p>
          </div>
        </section>

        <section className="py-10">
          <p className="max-w-3xl mx-auto px-4 sm:px-7 text-xs text-brand-muted leading-relaxed">
            This audit is a snapshot of public information and can change. No results are guaranteed.
          </p>
        </section>
      </main>
      <Footer />
    </>
  )
}
