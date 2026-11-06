import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  CONNECTION_POINTS,
  CREDIT_REPAIR_LIMITS,
  CREDIT_REPAIR_STEPS,
  FUNDING_LENDER_LOOKS_AT,
  FUNDING_OPTIONS,
  FUNDING_STEPS,
  SHAREABLE_RESOURCES,
  TALKING_POINTS,
  TOOLKIT_DEFINITIONS,
  TOOLKIT_FAQS,
  TOOLKIT_INTRO,
  TOOLKIT_SECTIONS,
  TOOLKIT_UNAVAILABLE_FACTS,
  WHAT_NOT_TO_PROMISE,
  WHO_DOES_WHAT,
} from '@/lib/partner-toolkit'
import { CopyTextButton, PrintToolkitButton } from '@/components/partner/PartnerToolkitActions'
import {
  ConnectionFlow,
  DefinitionIcon,
  ToolkitStepPath,
} from '@/components/partner/PartnerToolkitVisuals'

const cardClass = 'min-w-0 rounded-2xl border border-brand-border bg-white p-5 sm:p-6'
const sectionClass = 'scroll-mt-28 space-y-5'
const h2Class = 'font-serif text-3xl font-extrabold leading-tight text-brand-text sm:text-4xl'

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-brand-text">
      <span className="border-b-2 border-accent pb-0.5">{children}</span>
    </p>
  )
}

export default function PartnerToolkit() {
  return (
    <main id="main" className="partner-toolkit mx-auto max-w-[1100px] px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-10">
        <SectionLabel>{TOOLKIT_INTRO.kicker}</SectionLabel>
        <h1 className="font-serif text-4xl font-extrabold leading-tight text-brand-text sm:text-5xl">
          {TOOLKIT_INTRO.title}
        </h1>
        <p className="mt-4 max-w-[40rem] text-lg leading-relaxed text-brand-muted">{TOOLKIT_INTRO.lead}</p>
        <p className="mt-4 rounded-2xl border border-accent/40 bg-accent-soft px-5 py-4 text-base font-semibold leading-relaxed text-brand-text">
          {TOOLKIT_INTRO.banner}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <PrintToolkitButton />
        </div>
        <nav aria-label="Toolkit sections" className="partner-print-hide mt-6 print:hidden">
          <ul className="flex flex-wrap gap-2">
            {TOOLKIT_SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-brand-border bg-white px-4 py-2 text-base font-semibold text-brand-text hover:border-accent hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <section className={`${sectionClass} mb-14`} aria-labelledby="toolkit-words">
        <SectionLabel>Words to know</SectionLabel>
        <h2 id="toolkit-words" className={h2Class}>
          Three ideas. Keep them separate.
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TOOLKIT_DEFINITIONS.map((item) => (
            <article key={item.id} className={cardClass}>
              <DefinitionIcon id={item.id} />
              <h3 className="mt-4 text-2xl font-bold text-brand-text">{item.title}</h3>
              <p className="mt-2 text-lg font-semibold leading-relaxed text-brand-text">{item.meaning}</p>
              <p className="mt-2 text-base leading-relaxed text-brand-muted">{item.detail}</p>
              <p className="mt-4 rounded-xl bg-neutral-50 px-3 py-2 text-base leading-relaxed text-brand-muted">
                <span className="font-semibold text-brand-text">Not this: </span>
                {item.not}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="credit-repair" className={`${sectionClass} mb-14`}>
        <SectionLabel>Credit repair</SectionLabel>
        <h2 className={h2Class}>Review. Spot issues. Dispute the right way.</h2>
        <p className="max-w-[40rem] text-lg leading-relaxed text-brand-muted">
          Sunday Harmony starts with the file. Then they act only on inaccurate or unverifiable information.
        </p>
        <ToolkitStepPath title="The client path" steps={CREDIT_REPAIR_STEPS} />
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {CREDIT_REPAIR_LIMITS.map((limit) => (
            <li key={limit} className="rounded-2xl border border-brand-border bg-white px-5 py-4 text-base font-semibold leading-relaxed text-brand-text">
              {limit}
            </li>
          ))}
        </ul>
      </section>

      <section id="business-funding" className={`${sectionClass} mb-14`}>
        <SectionLabel>Business funding</SectionLabel>
        <h2 className={h2Class}>Share the business. Lenders decide.</h2>
        <p className="max-w-[40rem] text-lg leading-relaxed text-brand-muted">
          This is not a loan approval. It is not the credit-repair form. Sunday Harmony reviews the business, then talks through options.
        </p>
        <ToolkitStepPath title="The funding path" steps={FUNDING_STEPS} />
        <h3 className="text-2xl font-bold text-brand-text">What reviewers look at</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FUNDING_LENDER_LOOKS_AT.map((item, index) => (
            <article key={item.title} className={cardClass}>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand-text">0{index + 1}</p>
              <h4 className="mt-2 text-xl font-bold text-brand-text">{item.title}</h4>
              <p className="mt-2 text-base leading-relaxed text-brand-muted">{item.body}</p>
            </article>
          ))}
        </div>
        <h3 className="text-2xl font-bold text-brand-text">Common options</h3>
        <p className="text-base leading-relaxed text-brand-muted">
          Faster usually costs more. Cheaper usually asks for a stronger file. Terms vary by lender. Nothing here is an offer.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {FUNDING_OPTIONS.map((item) => (
            <article key={item.title} className={cardClass}>
              <h4 className="text-xl font-bold text-brand-text">{item.title}</h4>
              <p className="mt-2 text-base leading-relaxed text-brand-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-they-connect" className={`${sectionClass} mb-14`}>
        <SectionLabel>How they connect</SectionLabel>
        <h2 className={h2Class}>Personal credit can affect some business loans. It does not erase risk.</h2>
        <ConnectionFlow />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {CONNECTION_POINTS.map((item) => (
            <article key={item.title} className={cardClass}>
              <h3 className="text-xl font-bold text-brand-text">{item.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-brand-muted">{item.body}</p>
            </article>
          ))}
        </div>
        <h3 className="text-2xl font-bold text-brand-text">Who does what</h3>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {WHO_DOES_WHAT.map((item, index) => (
            <li key={item.title} className={cardClass}>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand-text">Role {index + 1}</p>
              <h4 className="mt-2 text-xl font-bold text-brand-text">{item.title}</h4>
              <p className="mt-2 text-base leading-relaxed text-brand-muted">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="what-to-say" className={`${sectionClass} mb-14`}>
        <SectionLabel>What to say</SectionLabel>
        <h2 className={h2Class}>One true sentence at a time.</h2>
        <p className="max-w-[40rem] text-lg leading-relaxed text-brand-muted">
          Copy a line. Say it in your own voice if you want. Do not add a promise.
        </p>
        <ul className="space-y-4">
          {TALKING_POINTS.map((point) => (
            <li key={point.id} className={`${cardClass} flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between`}>
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand-text">{point.label}</p>
                <p className="mt-2 text-lg leading-relaxed text-brand-text">{point.text}</p>
              </div>
              <CopyTextButton text={point.text} label={point.label} />
            </li>
          ))}
        </ul>
      </section>

      <section id="what-not-to-promise" className={`${sectionClass} mb-14`}>
        <SectionLabel>What not to promise</SectionLabel>
        <h2 className={h2Class}>Do not sell a result you cannot keep.</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {WHAT_NOT_TO_PROMISE.map((item) => (
            <article key={item.title} className="min-w-0 rounded-2xl border border-brand-border bg-white p-5 sm:p-6">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand-red">Do not say</p>
              <h3 className="mt-2 text-xl font-bold text-brand-text">{item.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-brand-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="quick-answers" className={`${sectionClass} mb-14`}>
        <SectionLabel>Quick answers</SectionLabel>
        <h2 className={h2Class}>Short questions. Straight answers.</h2>
        <div className="space-y-4">
          {TOOLKIT_FAQS.map((item) => (
            <article key={item.q} className={cardClass}>
              <h3 className="text-xl font-bold text-brand-text">{item.q}</h3>
              <p className="mt-2 text-base leading-relaxed text-brand-muted">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="next-step" className={`${sectionClass} mb-8`}>
        <SectionLabel>Next step</SectionLabel>
        <h2 className={h2Class}>Share the existing referral path. Do not submit a live application.</h2>
        <p className="max-w-[40rem] text-lg leading-relaxed text-brand-muted">
          Your tracked partner link is on the Dashboard. It opens the personal credit intake after approval. These public pages are safe to share as education.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {SHAREABLE_RESOURCES.map((item) => (
            <article key={item.id} className={cardClass}>
              <h3 className="text-xl font-bold text-brand-text">{item.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-brand-muted">{item.note}</p>
              <p className="mt-3 font-mono text-base text-brand-text">{item.href}</p>
              <Link
                href={item.href}
                className="mt-4 inline-flex min-h-11 items-center text-base font-semibold text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Open {item.title}
              </Link>
            </article>
          ))}
        </div>
        <div className="rounded-2xl border border-brand-border bg-white px-5 py-4">
          {TOOLKIT_UNAVAILABLE_FACTS.map((line) => (
            <p key={line} className="text-base leading-relaxed text-brand-muted">
              {line}
            </p>
          ))}
        </div>
      </section>
    </main>
  )
}
