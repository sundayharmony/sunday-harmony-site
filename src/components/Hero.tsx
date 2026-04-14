import { heroAuditHighlights, heroStats } from '@/lib/data'

export default function Hero() {
  return (
    <section
      className="min-h-screen flex items-center pt-[92px] pb-16 relative overflow-hidden bg-gradient-to-br from-white via-[#fafaf8] to-[#f5f3ee]"
      id="hero"
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(184,148,63,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(184,148,63,0.035)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none opacity-40" />
      <div className="absolute -top-1/2 -right-1/5 w-[760px] h-[760px] rounded-full bg-[radial-gradient(circle,rgba(184,148,63,0.12)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute -bottom-1/3 -left-1/6 w-[560px] h-[560px] rounded-full bg-[radial-gradient(circle,rgba(46,123,181,0.08)_0%,transparent_72%)] pointer-events-none" />

      <div className="max-w-[1180px] mx-auto px-7 relative z-10 w-full">
        <div className="grid lg:grid-cols-[1.06fr_0.94fr] gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(184,148,63,0.08)] border border-[rgba(184,148,63,0.2)] text-xs font-semibold text-brand-gold tracking-wide mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
              NJ&apos;s All-in-One Marketing Partner
            </div>

            <h1 className="font-serif text-[clamp(40px,6.2vw,68px)] font-extrabold leading-[1.02] text-brand-text mb-7">
              Stop guessing at marketing.
              <span className="block mt-1 italic bg-gradient-to-r from-brand-gold-light via-brand-gold to-[#a77f2c] bg-clip-text text-transparent">
                Start growing with clarity.
              </span>
            </h1>

            <p className="text-lg text-brand-muted leading-relaxed mb-10 max-w-[560px]">
              We help New Jersey small businesses get found online, generate better leads, and grow revenue
              with one partner handling strategy, execution, and reporting.
            </p>

            <div className="flex gap-3.5 flex-wrap mb-6">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-brand-gold text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(184,148,63,0.3)] transition-all"
              >
                Get Your Free Audit &rarr;
              </a>
              <a
                href="#packages"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg border border-brand-gold text-brand-gold text-sm font-semibold bg-white/65 backdrop-blur-sm hover:bg-[rgba(184,148,63,0.08)] transition-all"
              >
                See Packages
              </a>
            </div>

            <p className="text-sm text-brand-dim">
              No long-term contracts. Transparent reporting. Real local growth.
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
            <div className="absolute -top-8 -left-7 h-28 w-28 rounded-full border border-brand-gold/30 bg-white/70 backdrop-blur-md" />
            <div className="absolute -bottom-10 -right-6 h-24 w-24 rounded-full border border-brand-blue/30 bg-white/65 backdrop-blur-md" />

            <div className="relative rounded-3xl border border-brand-border bg-white/80 backdrop-blur-sm p-7 shadow-[0_28px_80px_rgba(10,20,40,0.12)]">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-brand-dim mb-2">No obligation</p>
                  <h3 className="text-2xl font-extrabold text-brand-text leading-tight">
                    What&apos;s in your free audit
                  </h3>
                </div>
                <div className="shrink-0 px-3 py-1.5 rounded-full bg-[rgba(184,148,63,0.12)] border border-[rgba(184,148,63,0.25)] text-[11px] font-bold text-brand-gold tracking-wide">
                  24hr response
                </div>
              </div>

              <p className="text-sm text-brand-muted leading-relaxed mb-6">
                A practical review of how customers find you today—and the highest-impact fixes first, tailored to New Jersey local businesses.
              </p>

              <ul className="space-y-3 mb-7">
                {heroAuditHighlights.map((line) => (
                  <li key={line} className="flex gap-3 text-sm text-brand-text leading-snug">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(45,138,98,0.12)] text-[11px] font-bold text-brand-green"
                      aria-hidden
                    >
                      ✓
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#contact"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-gold bg-[rgba(184,148,63,0.08)] px-4 py-3.5 text-sm font-semibold text-brand-text transition-all hover:bg-[rgba(184,148,63,0.14)] hover:-translate-y-0.5"
              >
                Request your free audit
                <span aria-hidden className="text-brand-gold">→</span>
              </a>
              <p className="mt-3 text-center text-[11px] text-brand-dim">
                No spam. We&apos;ll email or call with next steps.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
