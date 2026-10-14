import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ContactHeroVisual from '@/components/contact/ContactHeroVisual'
import { heroAuditHighlights, siteConfig } from '@/lib/data'

const ContactForm = dynamic(() => import('@/components/ContactForm'), {
  loading: () => (
    <div className="bg-white border border-brand-border rounded-[20px] p-9 shadow-sm text-center text-sm text-brand-muted py-16">
      Loading form…
    </div>
  ),
})

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Request a free business audit, ask a question, or start a conversation with Sunday Harmony Consulting.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact | Sunday Harmony',
    description: 'Get a free audit of your online presence and a clear next step for your business.',
    url: '/contact',
  },
}

const auditIcons = ['📍', '⚡', '📱', '🎯', '🗺️']

const auditCards = heroAuditHighlights.map((item, index) => ({
  number: String(index + 1).padStart(2, '0'),
  text: item.text,
  icon: auditIcons[index % auditIcons.length],
}))

const steps = [
  { title: 'You send a note', body: 'Name, business, and what you are trying to solve. No long questionnaire.' },
  { title: 'We read your file', body: 'Sunday Harmony reviews your site, listings, and goals—not a generic template.' },
  { title: 'You get the audit', body: 'Within about a business day: what is working, what is not, and what to fix first.' },
  { title: 'You choose what is next', body: 'Implement with us, on your own, or pause. No pressure and no obligation.' },
]

const faqs = [
  {
    q: 'Is the audit really free?',
    a: 'Yes. It is a written look at your online presence and priorities. There is no fee and no automatic follow-up sales sequence.',
  },
  {
    q: 'What if I am not sure which service I need?',
    a: 'Leave the service dropdown blank or pick “Not sure.” Tell us what feels stuck—we will point you in the right direction.',
  },
  {
    q: 'Do you work with businesses outside marketing?',
    a: 'Our core work is brand, strategy, and systems for growing businesses. Funding and personal credit have their own intake paths if those are what you need.',
  },
  {
    q: 'How fast will you reply?',
    a: 'Most messages get a response within one business day. Urgent issues? Say so in the message and we will prioritize.',
  },
]

const contactChannels = [
  { icon: '✉', label: 'Email', display: siteConfig.email, href: `mailto:${siteConfig.email}` },
  {
    icon: '🌐',
    label: 'Website',
    display: siteConfig.url.replace(/^https?:\/\//, '').replace(/^www\./, ''),
    href: siteConfig.url,
    external: true,
  },
]

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main id="main" className="pt-[var(--nav-total-height)]">
        <section className="relative overflow-hidden bg-gradient-to-br from-white via-neutral-50 to-neutral-100">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
          <div className="absolute -top-1/3 -right-1/6 w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(184,148,63,0.12)_0%,transparent_70%)] pointer-events-none" />
          <div className="relative z-10 max-w-[1180px] mx-auto px-7 py-16 sm:py-20 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-soft border border-brand-border text-xs font-semibold text-accent tracking-wide mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Get in touch
              </div>
              <h1 className="font-serif text-[clamp(40px,6vw,66px)] font-extrabold leading-[1.03] text-brand-text mb-6">
                Start the conversation.
                <span className="block mt-1 italic text-accent">Your business deserves a clear plan.</span>
              </h1>
              <p className="text-lg text-brand-muted leading-relaxed mb-9 max-w-[540px]">
                Tell us where you are stuck. We will send a free audit of your online presence—plain English, prioritized next steps, and no obligation to hire us.
              </p>
              <div className="flex gap-3.5 flex-wrap mb-8">
                <a
                  href="#message"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-brand-text text-white text-sm font-semibold hover:-translate-y-0.5 hover:bg-neutral-800 transition-all"
                >
                  Send a message →
                </a>
                <a
                  href="#audit"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg border border-brand-border text-brand-text text-sm font-semibold bg-white/80 backdrop-blur-sm hover:bg-neutral-50 transition-all"
                >
                  What&apos;s in the audit
                </a>
              </div>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-muted">
                {['Free, no obligation', 'Reply within ~1 business day', 'Brand, strategy & systems'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft border border-brand-border text-[11px] font-bold text-accent"
                      aria-hidden
                    >
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute -top-6 -left-6 h-24 w-24 rounded-full border border-brand-border bg-white/80 backdrop-blur-md" />
              <div className="absolute -bottom-8 -right-4 h-20 w-20 rounded-full border border-brand-border bg-white/80 backdrop-blur-md" />
              <div className="relative">
                <ContactHeroVisual />
              </div>
              <span className="sr-only">
                Decorative illustration: message bubbles, a desk, and an envelope in motion, with icons for email, calendar, and ideas.
              </span>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white" id="audit">
          <div className="max-w-[1100px] mx-auto px-7">
            <div className="section-label">Free audit</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,48px)] font-extrabold leading-[1.1] text-brand-text mb-4 max-w-[680px]">
              Five things we look at <span className="gold-text">before we recommend anything</span>
            </h2>
            <p className="text-[15px] text-brand-muted leading-relaxed mb-12 max-w-[600px]">
              Every audit is tailored to your business. These are the areas we most often review for owners who want more leads and a sharper brand.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {auditCards.map((item, index) => (
                <article
                  key={item.text}
                  className="group relative overflow-hidden rounded-2xl border border-brand-border bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-md hover:border-accent"
                >
                  <span
                    className="absolute -top-3 -right-1 font-serif text-[84px] font-extrabold leading-none text-accent/10 transition-colors group-hover:text-accent/20"
                    aria-hidden
                  >
                    {item.number}
                  </span>
                  <div className="relative">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-border bg-accent-soft text-[22px]">
                      {item.icon}
                    </div>
                    <p className="text-[15px] text-brand-text font-semibold leading-relaxed">{item.text}</p>
                  </div>
                </article>
              ))}
              <div className="rounded-2xl border border-dashed border-accent/50 bg-accent-soft/60 p-7 flex flex-col justify-center sm:col-span-2 lg:col-span-1">
                <p className="font-serif text-xl font-bold text-brand-text mb-2">Need funding or credit help?</p>
                <p className="text-sm text-brand-muted leading-relaxed mb-4">
                  Those paths use dedicated intakes so we collect the right details the first time.
                </p>
                <div className="flex flex-col gap-2 text-sm font-semibold">
                  <a href="/funding" className="text-accent hover:underline">Business funding →</a>
                  <a href="/credit-funding?focus=credit" className="text-accent hover:underline">Personal credit →</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden py-24 bg-brand-text text-white" id="how">
          <div className="absolute -top-40 -right-32 w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(184,148,63,0.22)_0%,transparent_70%)] pointer-events-none" />
          <div className="relative max-w-[1100px] mx-auto px-7">
            <div className="section-label">How it works</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,48px)] font-extrabold leading-[1.1] mb-16 max-w-[640px]">
              From hello to <span className="italic text-accent">a useful audit</span>
            </h2>
            <ol className="relative grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6">
              <div
                className="hidden md:block absolute left-[6%] right-[6%] top-[27px] border-t border-dashed border-white/25"
                aria-hidden
              />
              {steps.map((step, index) => (
                <li key={step.title} className="relative">
                  <div className="relative z-10 mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-accent bg-brand-text font-serif text-xl font-extrabold text-accent">
                    {index + 1}
                  </div>
                  <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                  <p className="text-sm text-white/65 leading-relaxed">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="py-20 bg-brand-bg-soft" id="faq">
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
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-border bg-white text-lg leading-none text-accent transition-transform group-open:rotate-45"
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

        <section className="py-20 bg-white border-t border-brand-border" id="message">
          <div className="max-w-[1100px] mx-auto px-7">
            <div className="section-label">Send a message</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,46px)] font-extrabold leading-[1.1] text-brand-text mb-3">
              Let&apos;s talk about <span className="gold-text">your business</span>
            </h2>
            <p className="text-[15px] text-brand-muted leading-relaxed mb-12 max-w-[600px]">
              The form goes straight to our team. We use it to prepare your audit—not to add you to a generic mailing list.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-12 items-start">
              <div className="rounded-2xl border border-brand-border bg-brand-bg-soft p-8">
                <h3 className="font-serif text-2xl font-bold text-brand-text mb-3">Reach us directly</h3>
                <p className="text-sm text-brand-muted leading-relaxed mb-8">
                  Prefer email? Write anytime. We still recommend the form so we capture your business name and goals in one place.
                </p>
                <div className="space-y-5">
                  {contactChannels.map((item) => (
                    <div key={item.label} className="flex gap-3.5 items-start">
                      <div className="w-11 h-11 rounded-xl bg-white border border-brand-border flex items-center justify-center text-lg flex-shrink-0">
                        {item.icon}
                      </div>
                      <div>
                        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-0.5">
                          {item.label}
                        </div>
                        <a
                          href={item.href}
                          className="text-[15px] text-brand-text font-medium hover:text-accent transition-colors"
                          {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        >
                          {item.display}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <ContactForm embed />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
