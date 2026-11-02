import Link from 'next/link'
import { packages, packagePriceDisplay, packageDisclaimer } from '@/lib/data'
import SectionHeader from '@/components/ui/SectionHeader'

const colorMap: Record<string, string> = {
  blue: 'text-brand-muted',
  green: 'text-brand-muted',
  gold: 'text-accent',
  purple: 'text-brand-muted',
}

function priceSuffixLabel(pkg: (typeof packages)[number]): string | null {
  if (pkg.priceSuffix === 'one-time') return 'one-time'
  if (pkg.priceSuffix === 'monthly') return '/month'
  if (pkg.priceSuffix === 'quote') return null
  if (pkg.price != null) return '/month'
  return null
}

export default function Packages() {
  return (
    <section className="py-24" id="packages">
      <div className="max-w-[1200px] mx-auto px-7">
        <SectionHeader
          label="Pricing"
          title={
            <>
              Packages built for <span className="gold-text">every stage of growth</span>
            </>
          }
          description="Four ways to work together. One-time projects, ongoing support, or custom work."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
          {packages.map((pkg) => {
            const included = pkg.features.filter((feat) => feat.included)
            const suffix = priceSuffixLabel(pkg)
            return (
              <div
                key={pkg.tier}
                className={`bg-white rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                  pkg.popular
                    ? 'border-2 border-brand-text shadow-sm'
                    : 'border border-brand-border'
                }`}
              >
                {pkg.popular && (
                  <div className="py-1.5 text-center text-[10px] font-bold tracking-[0.14em] uppercase bg-brand-text text-white">
                    Most Popular
                  </div>
                )}
                <div className="p-5">
                  <div className="text-2xl mb-2">{pkg.icon}</div>
                  <div className="text-base font-bold text-brand-text mb-1">{pkg.tier}</div>
                  <div className={`text-xs font-semibold mb-3 ${colorMap[pkg.color] || 'text-brand-muted'}`}>
                    {pkg.tagline}
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="font-serif text-2xl font-extrabold text-brand-text">
                      {packagePriceDisplay(pkg)}
                    </span>
                    {suffix && <span className="text-[11px] text-brand-dim">{suffix}</span>}
                  </div>
                  <div className="text-[11px] text-brand-dim leading-snug mb-4 min-h-[32px]">
                    {pkg.ideal}
                  </div>

                  <div className="border-t border-brand-border pt-3">
                    {included.map((feat) => (
                      <div key={feat.text} className="flex gap-2 mb-1.5 text-[11px] leading-snug">
                        <span className="flex-shrink-0 mt-px text-brand-text">✓</span>
                        <span className="text-brand-muted">{feat.text}</span>
                      </div>
                    ))}
                  </div>

                  <Link
                    href="/book"
                    className={`block w-full py-2.5 mt-4 rounded-lg text-center text-[12px] font-semibold transition-all ${
                      pkg.popular
                        ? 'bg-brand-text text-white font-bold hover:bg-neutral-800'
                        : 'border border-brand-border text-brand-text hover:bg-neutral-50'
                    }`}
                  >
                    {pkg.ctaLabel ?? 'Get Started'}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        <div className="text-center mt-9 text-sm text-brand-dim max-w-2xl mx-auto space-y-2">
          <p>
            All packages include a{' '}
            <strong className="text-accent">free Google Business audit</strong> to start.
            Marketing Partner is month-to-month &mdash; cancel anytime.
          </p>
          <p className="text-xs">{packageDisclaimer}</p>
        </div>
      </div>
    </section>
  )
}
