export default function CtaBanner() {
  return (
    <section className="py-24 pt-0">
      <div className="max-w-[1100px] mx-auto px-7">
        <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 border border-brand-border rounded-3xl py-16 px-14 text-center relative overflow-hidden">
          <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(0,0,0,0.04)_0%,transparent_60%)] pointer-events-none" />
          <h2 className="font-serif text-[clamp(28px,4vw,42px)] font-extrabold text-brand-text mb-4 relative">
            Ready to stop doing it all{' '}
            <em className="font-serif not-italic text-accent">yourself?</em>
          </h2>
          <p className="text-[17px] text-brand-muted mb-9 max-w-[500px] mx-auto relative">
            Get a free audit of your online presence &mdash; we&apos;ll show you exactly what&apos;s working, what&apos;s not, and how to fix it. No strings attached.
          </p>
          <a
            href="#contact"
            className="relative inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-brand-text text-white text-sm font-semibold hover:-translate-y-0.5 hover:bg-neutral-800 transition-all"
          >
            Get Your Free Audit &rarr;
          </a>
        </div>
      </div>
    </section>
  )
}
