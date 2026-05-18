import { processSteps } from '@/lib/data'

export default function Process() {
  return (
    <section className="py-24 bg-brand-bg-soft" id="process">
      <div className="max-w-[1100px] mx-auto px-7">
        <div className="section-label">How It Works</div>
        <h2 className="font-serif text-[clamp(32px,5vw,52px)] font-extrabold leading-[1.12] text-brand-text mb-5">
          From first call to <span className="gold-text">first results</span>
        </h2>
        <p className="text-[17px] text-brand-muted max-w-[580px] leading-relaxed">
          We make getting started simple. Here&apos;s what happens when you reach out.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden lg:block absolute top-10 left-14 right-14 h-px bg-gradient-to-r from-neutral-300 via-accent-soft to-transparent" />

          {processSteps.map((step) => (
            <div key={step.num} className="text-center relative">
              <div className="w-[52px] h-[52px] rounded-full mx-auto mb-5 bg-accent-soft border-2 border-brand-border flex items-center justify-center font-serif text-xl font-extrabold text-accent relative z-10 bg-white">
                {step.num}
              </div>
              <h4 className="text-base font-bold text-brand-text mb-2">{step.title}</h4>
              <p className="text-[13px] text-brand-muted leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
