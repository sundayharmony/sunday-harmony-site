import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import AuditForm from '@/components/audit/AuditForm'
import { brandLogos } from '@/lib/brand-tokens'
import { NO_INDEX } from '@/lib/seo'

// Ad landing page: kept out of search so it doesn't compete with the main pages.
export const metadata: Metadata = {
  title: 'Free audit',
  description: 'Get a free audit of your Google profile, website, social, ad spend and competitors.',
  alternates: { canonical: '/audit' },
  robots: NO_INDEX,
}

const offers = {
  launch: {
    name: 'Business Launch',
    headline: 'Great reviews. No website to send them to.',
    lead: "Your customers already trust you. We'll show you where your online presence is losing them, and what to fix first. Free, with no obligation.",
  },
  essentials: {
    name: 'Business Essentials',
    headline: 'Your work is premium. Does your brand look it?',
    lead: "We'll show you where your logo, colors and social pages undersell what you charge, and what to fix first. Free, with no obligation.",
  },
} as const

const checks = [
  ['Google profile', 'Hours, photos, reviews, posts and the link to your site.'],
  ['Website', 'Speed, phone layout, and whether visitors can book or ask for a quote.'],
  ['Social', 'Whether your pages look like one brand and match what you charge.'],
  ['Ad spend', "Where your money goes now, and what's wasted."],
  ['Competitors', "What the top businesses near you do that you don't."],
]

const steps = [
  ['01', 'Free audit', 'We review your Google profile, site, social, ads and competitors.'],
  ['02', 'Custom plan', 'You get a short, prioritized plan with a clear price. No pressure.'],
  ['03', 'Quick win in 30 days', 'We start with the fix that brings the most calls first.'],
]

const packages = [
  ['Business Essentials', 'From $899', 'Logo, palette, guidelines, cards and social branding.'],
  ['Business Launch', 'From $2,499', 'Brand plus a 5-page site, forms, basic SEO, Google profile and social setup.'],
  ['Marketing Partner', '$1,200/mo', 'Monthly strategy call and report, 12 posts, site updates, SEO upkeep. Cancel anytime.'],
]

const faqs = [
  ['Is the audit really free?', 'Yes. You get the audit and a plan whether or not you hire us.'],
  ['Do I have to sign a long contract?', 'No. Packages are one-time, and Marketing Partner is month to month.'],
  ['Do you only work in New Jersey?', 'No. We work with businesses anywhere in the US.'],
  ['How fast will I hear back?', 'Within 24 hours, by email or phone.'],
]

const wrap = 'max-w-[1180px] mx-auto px-7'
const kicker = 'section-label'
const h2 = 'font-serif text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.015em] mb-10'

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ offer?: string }> }) {
  const { offer: param } = await searchParams
  const offer = param === 'essentials' ? offers.essentials : offers.launch

  return (
    <main id="main" className="bg-brand-bg text-brand-text">
      <div className={`${wrap} flex justify-between items-center py-6`}>
        <Link href="/" aria-label="Sunday Harmony home">
          <Image src={brandLogos.black} alt="Sunday Harmony" width={120} height={Math.round(120 / brandLogos.aspectRatio)} priority />
        </Link>
        <a href="#form" className="text-sm font-semibold text-accent-ink hover:text-brand-text">Get a free audit</a>
      </div>

      <section className={`${wrap} grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-start pt-6 pb-14 lg:pt-14 lg:pb-[5.5rem]`}>
        <div>
          <div className={kicker}>Free audit</div>
          <h1 className="font-serif text-[clamp(2.15rem,5.5vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.02em] mb-6">{offer.headline}</h1>
          <p className="text-[1.1875rem] leading-[1.55] text-brand-muted mb-6 max-w-[34rem]">{offer.lead}</p>
          <ul className="grid gap-3 font-medium">
            {['A clear look at your Google profile, site and social', 'A prioritized plan with real prices', 'No long-term contracts'].map((t) => (
              <li key={t} className="flex gap-3 items-center">
                <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-accent flex-none" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <AuditForm offer={offer.name} />
      </section>

      <section className="bg-brand-bg-soft py-14 lg:py-[5.5rem]">
        <div className={wrap}>
          <div className={kicker}>What we check</div>
          <h2 className={h2}>Five places customers decide about you.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {checks.map(([t, d], i) => (
              <div key={t} className="bg-brand-paper border border-brand-border rounded-[20px] p-6">
                <div className="text-[11px] font-bold tracking-[0.16em] text-accent-ink">0{i + 1}</div>
                <h3 className="font-serif text-[1.375rem] font-semibold tracking-[-0.015em] my-2">{t}</h3>
                <p className="text-[15px] leading-[1.55] text-brand-muted">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand-text text-brand-bg py-14 lg:py-[5.5rem]">
        <div className={wrap}>
          <div className={kicker}>How it works</div>
          <h2 className={h2}>From audit to your first win.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {steps.map(([n, t, d]) => (
              <div key={n} className="border-t border-[#3a372f] pt-6">
                <div className="font-serif text-[2.5rem] text-accent">{n}</div>
                <h3 className="font-serif text-[1.375rem] font-semibold tracking-[-0.015em] my-2">{t}</h3>
                <p className="text-[15px] leading-[1.55] text-[#d9d2c4]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 lg:py-[5.5rem]">
        <div className={wrap}>
          <div className={kicker}>Packages</div>
          <h2 className={h2}>Clear prices. Pick what fits.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-3">
            {packages.map(([t, p, d]) => {
              const hi = t === offer.name
              return (
                <div key={t} className={`relative bg-brand-paper border rounded-[20px] p-8 ${hi ? 'border-accent shadow-[0_18px_40px_-24px_rgba(27,26,23,0.35)]' : 'border-brand-border'}`}>
                  {hi && (
                    <div className="absolute -top-3.5 left-6 bg-brand-text text-brand-bg text-[11px] font-bold tracking-[0.12em] uppercase px-3 py-1.5 rounded-full">
                      Matches your ad
                    </div>
                  )}
                  <h3 className="font-serif text-[1.375rem] font-semibold tracking-[-0.015em] my-2">{t}</h3>
                  <div className="font-serif text-[2rem] font-semibold mb-4">{p}</div>
                  <p className="text-[15px] leading-[1.55] text-brand-muted">{d}</p>
                </div>
              )
            })}
          </div>
          <p className="text-[13px] text-brand-dim mt-6">Printing, hosting, ad spend and video are quoted separately.</p>
        </div>
      </section>

      <section className="bg-brand-bg-soft py-14 lg:py-[5.5rem]">
        <div className={wrap}>
          <div className={kicker}>Questions</div>
          <h2 className={h2}>Before you ask.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {faqs.map(([q, a]) => (
              <div key={q} className="border-t border-brand-border pt-5">
                <h3 className="font-serif text-[1.375rem] font-semibold tracking-[-0.015em] mb-2">{q}</h3>
                <p className="text-[15px] leading-[1.55] text-brand-muted">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${wrap} text-center py-14 lg:py-[5.5rem]`}>
        <h2 className={`${h2} !mb-6`}>See what&apos;s costing you customers.</h2>
        <a href="#form" className="inline-flex items-center justify-center min-h-[52px] px-8 rounded-full bg-brand-text text-brand-bg font-semibold w-full sm:w-auto">
          Get your free audit
        </a>
      </section>

      <footer className={`${wrap} border-t border-brand-border py-6 text-sm text-brand-dim flex flex-wrap justify-between gap-4`}>
        <span>Sunday Harmony Consulting · Brand, strategy, and systems.</span>
        <a href="mailto:sales@sundayharmony.com" className="hover:text-brand-text">sales@sundayharmony.com</a>
      </footer>
    </main>
  )
}
