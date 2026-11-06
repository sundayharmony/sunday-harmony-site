import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Fund',
  description:
    'Choose your path: build personal credit or fund your business. Sunday Harmony helps with both.',
  alternates: { canonical: '/build-fund' },
  openGraph: {
    title: 'Fund | Sunday Harmony',
    description: 'Personal credit building or business funding — pick your path.',
    url: '/build-fund',
  },
}

const paths = [
  {
    id: 'build',
    icon: '📈',
    title: 'Build',
    subtitle: 'Personal Credit',
    description: 'Strengthen your credit score. Review your file, dispute inaccuracies, and track progress across all three bureaus.',
    features: ['Credit analysis', 'Dispute letters', 'Score tracking'],
    href: '/credit',
    cta: 'Start building →',
  },
  {
    id: 'fund',
    icon: '💰',
    title: 'Fund',
    subtitle: 'Business Funding',
    description: 'Get capital for your business. Equipment, working capital, lines of credit, and more — matched to your profile.',
    features: ['Multiple options', 'No SSN required', 'Fast review'],
    href: '/funding',
    cta: 'Get funded →',
  },
]

export default function BuildFundPage() {
  return (
    <>
      <Navbar />
      <main id="main" className="pt-[var(--nav-total-height)] min-h-screen bg-gradient-to-br from-white via-neutral-50 to-neutral-100">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
        
        <section className="relative z-10 max-w-[1100px] mx-auto px-7 py-20 sm:py-28">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-soft border border-brand-border text-xs font-semibold text-accent tracking-wide mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Choose your path
            </div>
            <h1 className="font-serif text-[clamp(36px,6vw,60px)] font-extrabold leading-[1.05] text-brand-text mb-5">
              Fund
            </h1>
            <p className="text-lg text-brand-muted leading-relaxed max-w-[540px] mx-auto">
              Two paths to financial strength. Pick the one that fits where you are today.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {paths.map((path) => (
              <Link
                key={path.id}
                href={path.href}
                className="group relative overflow-hidden rounded-3xl border-2 border-brand-border bg-white p-8 sm:p-10 transition-all duration-300 hover:border-accent hover:shadow-xl hover:-translate-y-1"
              >
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-accent/5 transition-transform duration-300 group-hover:scale-150" />
                <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-accent/5 transition-transform duration-300 group-hover:scale-125" />
                
                <div className="relative">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-border bg-accent-soft text-3xl transition-transform duration-300 group-hover:scale-110">
                      {path.icon}
                    </div>
                    <div>
                      <h2 className="font-serif text-3xl font-extrabold text-brand-text">{path.title}</h2>
                      <p className="text-sm font-medium text-accent">{path.subtitle}</p>
                    </div>
                  </div>

                  <p className="text-[15px] text-brand-muted leading-relaxed mb-6">
                    {path.description}
                  </p>

                  <ul className="flex flex-wrap gap-2 mb-8">
                    {path.features.map((feature) => (
                      <li
                        key={feature}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 text-xs font-medium text-brand-text"
                      >
                        <span className="w-1 h-1 rounded-full bg-accent" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-text text-white text-sm font-semibold transition-all duration-300 group-hover:bg-accent group-hover:gap-3">
                    {path.cta}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <p className="text-center text-sm text-brand-dim mt-12">
            Not sure which to start with? Most owners work on personal credit first — it often unlocks better business funding terms.
          </p>
        </section>
      </main>
      <Footer />
    </>
  )
}
