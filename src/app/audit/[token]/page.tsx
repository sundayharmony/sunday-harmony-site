import Link from 'next/link'
import { notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { loadAudit } from '@/lib/icp-audit-load'

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
              We looked at your public Google listing and your website the way a new customer would. Here is what we found
              and how to fix it.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link href="/book" className={`${pill} bg-brand-text text-brand-bg hover:-translate-y-0.5`}>
                Book a free call
              </Link>
              <a href={`/audit/${encodeURIComponent(token)}/pdf`} className={`${pill} border border-brand-text text-brand-text hover:-translate-y-0.5`}>
                Download PDF
              </a>
            </div>

            {audit.strengths.length ? (
              <div className="mt-12">
                <p className="section-label">What is working</p>
                <ul className="space-y-2">
                  {audit.strengths.map((s) => (
                    <li key={s} className="text-brand-text leading-relaxed">{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}

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
          </div>
        </section>

        <section className="bg-[#1b1a17] py-14 sm:py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold">Suggested next step</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#fbf7f0]">{audit.nextStep.name}</h2>
            <p className="mt-3 text-[#e6dbc6] leading-relaxed max-w-2xl">{audit.nextStep.detail}</p>
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
