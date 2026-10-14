import { packages, packagePriceDisplay } from '@/lib/data'
import SectionHeader from '@/components/ui/SectionHeader'

const colorMap: Record<string, string> = {
  blue: 'text-brand-muted',
  green: 'text-brand-muted',
  gold: 'text-accent',
  purple: 'text-brand-muted',
}

export default function Packages() {
  return (
    <section className="py-24" id="packages">
      <div className="max-w-[1100px] mx-auto px-7">
        <SectionHeader
          label="Pricing"
          title={
            <>
              Packages built for <span className="gold-text">every stage of growth</span>
            </>
          }
          description="Three ways to work together. No hidden fees. No long-term contracts."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
          {packages.map((pkg) => {
            const included = pkg.features.filter((feat) => feat.included)
            const custom = pkg.price == null
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
                <div className="p-6">
                  <div className="text-2xl mb-2.5">{pkg.icon}</div>
                  <div className="text-lg font-bold text-brand-text mb-1">{pkg.tier}</div>
                  <div className={`text-xs font-semibold mb-4 ${colorMap[pkg.color] || 'text-brand-muted'}`}>
                    {pkg.tagline}
                  </div>
                  <div className="flex items-baseline gap-1 mb-1.5">
                    <span className="font-serif text-4xl font-extrabold text-brand-text">
                      {packagePriceDisplay(pkg)}
                    </span>
                    {!custom && <span className="text-[13px] text-brand-dim">/month</span>}
                  </div>
                  <div className="text-xs text-brand-dim leading-snug mb-5 min-h-[36px]">
                    {pkg.ideal}
                  </div>

                  <div className="border-t border-brand-border pt-4">
                    {included.map((feat) => (
                      <div key={feat.text} className="flex gap-2 mb-2 text-xs leading-snug">
                        <span className="flex-shrink-0 mt-px text-brand-text">✓</span>
                        <span className="text-brand-muted">{feat.text}</span>
                      </div>
                    ))}
                  </div>

                  <a
                    href="/contact"
                    className={`block w-full py-3 mt-5 rounded-lg text-center text-[13px] font-semibold transition-all ${
                      pkg.popular
                        ? 'bg-brand-text text-white font-bold hover:bg-neutral-800'
                        : 'border border-brand-border text-brand-text hover:bg-neutral-50'
                    }`}
                  >
                    {pkg.ctaLabel ?? 'Get Started'}
                  </a>
                </div>
              </div>
            )
          })}
        </div>

        <div className="text-center mt-9 text-sm text-brand-dim">
          All packages include a{' '}
          <strong className="text-accent">free Google Business audit</strong> to start. No long-term
          contracts &mdash; cancel anytime.
        </div>
      </div>
    </section>
  )
}
