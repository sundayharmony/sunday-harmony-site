import { heroStats } from '@/lib/data'

export default function Hero() {
  return (
    <section className="min-h-screen flex items-center pt-[72px] relative overflow-hidden bg-gradient-to-br from-white via-[#fafaf8] to-[#f5f3ee]" id="hero">
      {/* Subtle background accents */}
      <div className="absolute -top-1/2 -right-1/5 w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(184,148,63,0.05)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute -bottom-1/3 -left-1/10 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(46,123,181,0.03)_0%,transparent_70%)] pointer-events-none" />

      <div className="max-w-[1100px] mx-auto px-7 relative z-10">
        <div className="max-w-[680px]">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(184,148,63,0.08)] border border-[rgba(184,148,63,0.18)] text-xs font-semibold text-brand-gold tracking-wide mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
            NJ&apos;s All-in-One Marketing Partner
          </div>

          <h1 className="font-serif text-[clamp(38px,6vw,62px)] font-extrabold leading-[1.08] text-brand-text mb-6">
            Stop guessing at marketing.{' '}
            <em className="italic bg-gradient-to-br from-brand-gold-light to-brand-gold bg-clip-text text-transparent">
              Start growing.
            </em>
          </h1>

          <p className="text-lg text-brand-muted leading-relaxed mb-10 max-w-[520px]">
            We help New Jersey small businesses get found online, generate leads, and grow revenue &mdash; with one dedicated partner who handles it all.
          </p>

          <div className="flex gap-3.5 flex-wrap">
            <a
              href="#contact"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-brand-gold text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(184,148,63,0.25)] transition-all"
            >
              Get Your Free Audit &rarr;
            </a>
            <a
              href="#packages"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg border border-brand-gold text-brand-gold text-sm font-semibold hover:bg-[rgba(184,148,63,0.06)] transition-all"
            >
              See Packages
            </a>
          </div>

          <div className="flex flex-wrap gap-6 sm:gap-10 mt-14 pt-10 border-t border-brand-border">
            {heroStats.map((stat) => (
              <div key={stat.label}>
                <div className="font-serif text-[28px] font-extrabold text-brand-text mb-1">
                  {stat.value}
                </div>
                <div className="text-xs text-brand-dim tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
