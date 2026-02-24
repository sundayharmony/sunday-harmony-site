export default function CtaBanner() {
  return (
    <section className="py-24 pt-0">
      <div className="max-w-[1100px] mx-auto px-7">
        <div className="bg-gradient-to-br from-[#14121e] via-[#1a152a] to-[#161a25] border border-[rgba(201,169,110,0.12)] rounded-3xl py-16 px-14 text-center relative overflow-hidden">
          <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(201,169,110,0.08)_0%,transparent_60%)] pointer-events-none" />
          <h2 className="font-serif text-[clamp(28px,4vw,42px)] font-extrabold text-brand-text mb-4 relative">
            Ready to stop doing it all{' '}
            <em className="font-serif text-brand-gold">yourself?</em>
          </h2>
          <p className="text-[17px] text-brand-muted mb-9 max-w-[500px] mx-auto relative">
            Get a free audit of your online presence &mdash; we&apos;ll show you exactly what&apos;s working, what&apos;s not, and how to fix it. No strings attached.
          </p>
          <a
            href="#contact"
            className="relative inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-gradient-to-br from-brand-gold to-[#b8944f] text-[#0a0a0f] text-sm font-semibold hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(201,169,110,0.3)] transition-all"
          >
            Get Your Free Audit &rarr;
          </a>
        </div>
      </div>
    </section>
  )
}
