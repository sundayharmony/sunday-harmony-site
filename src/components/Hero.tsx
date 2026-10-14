import { heroStats, heroSubtext, siteConfig } from '@/lib/data'
import AuditCtaButton from '@/components/ui/AuditCtaButton'
import HeroHarmonyVisual from '@/components/HeroHarmonyVisual'

export default function Hero() {
  return (
    <section
      className="min-h-screen flex items-center pt-[calc(var(--nav-total-height)+1.75rem)] pb-16 relative overflow-hidden bg-gradient-to-br from-white via-neutral-50 to-neutral-100"
      id="hero"
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
      <div className="absolute -top-1/2 -right-1/5 w-[760px] h-[760px] rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.04)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute -bottom-1/3 -left-1/6 w-[560px] h-[560px] rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.03)_0%,transparent_72%)] pointer-events-none" />

      <div className="max-w-[1180px] mx-auto px-7 relative z-10 w-full">
        <div className="grid lg:grid-cols-[1.06fr_0.94fr] gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-soft border border-brand-border text-xs font-semibold text-accent tracking-wide mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              {siteConfig.tagline}
            </div>

            <h1 className="font-serif text-[clamp(40px,6.2vw,68px)] font-extrabold leading-[1.02] text-brand-text mb-7">
              Stop guessing.
              <span className="block mt-1 italic text-accent">
                Start growing with a clear strategy.
              </span>
            </h1>

            <p className="text-lg text-brand-muted leading-relaxed mb-10 max-w-[560px]">
              {heroSubtext}
            </p>

            <div className="flex gap-3.5 flex-wrap mb-6">
              <AuditCtaButton variant="primary" />
              <a
                href="#packages"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg border border-brand-border text-brand-text text-sm font-semibold bg-white/80 backdrop-blur-sm hover:bg-neutral-50 transition-all"
              >
                See Packages
              </a>
            </div>

            <p className="text-sm text-brand-dim">
              No long-term contracts. Transparent reporting. A plan you can run.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 sm:gap-7 mt-12 pt-8 border-t border-brand-border">
              {heroStats.map((stat) => (
                <div key={stat.label}>
                  <div className="font-serif text-[30px] font-extrabold text-brand-text mb-1">{stat.value}</div>
                  <div className="text-xs text-brand-dim tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -top-8 -left-7 h-28 w-28 rounded-full border border-brand-border bg-white/80 backdrop-blur-md" />
            <div className="absolute -bottom-10 -right-6 h-24 w-24 rounded-full border border-brand-border bg-white/80 backdrop-blur-md" />

            <div className="relative rounded-3xl border border-brand-border bg-white/90 backdrop-blur-sm shadow-sm overflow-hidden">
              <HeroHarmonyVisual />
            </div>
            <span className="sr-only">
              Decorative illustration: three connected paths for building the business, funding, and personal credit.
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
