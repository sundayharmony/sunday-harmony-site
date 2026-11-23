type Faq = { q: string; a: string }

/** "Quick answers" accordion shared by the marketing pages. */
export default function FaqSection({
  faqs,
  background = 'bg-white',
}: {
  faqs: readonly Faq[]
  background?: 'bg-white' | 'bg-brand-bg-soft'
}) {
  return (
    <section className={`py-20 ${background}`} id="faq">
      <div className="max-w-[820px] mx-auto px-7">
        <div className="section-label">Good to know</div>
        <h2 className="font-serif text-[clamp(30px,4.6vw,44px)] font-extrabold leading-[1.1] text-brand-text mb-10">
          Quick answers
        </h2>
        <div className="space-y-3">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-brand-border bg-white px-6 py-5 transition-colors open:border-accent open:bg-accent-soft/40"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-brand-text [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-border bg-white text-lg leading-none text-accent-ink transition-transform group-open:rotate-45"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-brand-muted leading-relaxed pr-10">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
