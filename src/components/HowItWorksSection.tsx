type Step = { title: string; body: string }

/** Dark "How it works" band with numbered steps, shared by the marketing pages. */
export default function HowItWorksSection({
  lead,
  highlight,
  steps,
}: {
  lead: string
  highlight: string
  steps: readonly Step[]
}) {
  return (
    <section className="relative overflow-hidden py-24 bg-brand-text text-white" id="how">
      <div className="absolute -top-40 -right-32 w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(184,148,63,0.22)_0%,transparent_70%)] pointer-events-none" />
      <div className="relative max-w-[1100px] mx-auto px-7">
        <div className="section-label">How it works</div>
        <h2 className="font-serif text-[clamp(30px,4.6vw,48px)] font-extrabold leading-[1.1] mb-16 max-w-[640px]">
          {lead} <span className="italic text-accent-ink">{highlight}</span>
        </h2>
        <ol className="relative grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6">
          <div
            className="hidden md:block absolute left-[6%] right-[6%] top-[27px] border-t border-dashed border-white/25"
            aria-hidden
          />
          {steps.map((step, index) => (
            <li key={step.title} className="relative">
              <div className="relative z-10 mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-accent bg-brand-text font-serif text-xl font-extrabold text-accent-ink">
                {index + 1}
              </div>
              <h3 className="text-lg font-bold mb-2">{step.title}</h3>
              <p className="text-sm text-white/65 leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
