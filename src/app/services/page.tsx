import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Packages from '@/components/Packages'
import HeroHarmonyVisual from '@/components/HeroHarmonyVisual'
import { processSteps, services } from '@/lib/data'

export const metadata: Metadata = {
  title: 'Marketing Services',
  description:
    'Brand identity, website launch, and ongoing marketing support. Business Essentials, Business Launch, Marketing Partner, and Custom Solutions packages.',
  alternates: { canonical: '/services' },
  openGraph: {
    title: 'Marketing Services | Sunday Harmony',
    description:
      'See how Sunday Harmony builds the brand, the presence, and the strategy — and compare Business Essentials, Business Launch, Marketing Partner, and Custom Solutions.',
    url: '/services',
  },
}

const pillars = services.map((service, index) => ({
  ...service,
  number: String(index + 1).padStart(2, '0'),
}))

const faqs = [
  {
    q: 'Are these long-term contracts?',
    a: 'No. Business Essentials and Business Launch are one-time projects. Marketing Partner is monthly and can be cancelled anytime. The free Google Business audit is included so you can see the starting point before you commit.',
  },
  {
    q: 'What is the difference between the packages?',
    a: 'Business Essentials covers brand identity. Business Launch adds a website and launch setup. Marketing Partner is ongoing monthly support. Custom Solutions handles specialized projects like e-commerce, print, or ads.',
  },
  {
    q: 'Do I have to pick a package before we talk?',
    a: 'No. The fit check on this page is only a guide. Book a consultation and we will match the work to where the business actually is.',
  },
  {
    q: 'What is not included?',
    a: 'Printing, hosting, ad spend, and video production are not included unless quoted. We can coordinate these for you, but they are billed separately.',
  },
  {
    q: 'Is funding or credit repair part of these packages?',
    a: 'No. Marketing services are the main practice. Business funding and credit repair are separate paths, with their own pages.',
  },
]

export default function ServicesPage() {
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
                Marketing services
              </div>
              <h1 className="font-serif text-[clamp(40px,6vw,66px)] font-extrabold leading-[1.03] text-brand-text mb-6">
                Build the business.
                <span className="block mt-1 italic text-accent">Brand, strategy, and systems.</span>
              </h1>
              <p className="text-lg text-brand-muted leading-relaxed mb-9 max-w-[540px]">
                Sunday Harmony designs how the business looks and sounds, then keeps outreach steady while you run it. Start with the story, then choose the package that matches the stage.
              </p>
              <div className="flex gap-3.5 flex-wrap mb-8">
                <a
                  href="#packages"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-brand-text text-white text-sm font-semibold hover:-translate-y-0.5 hover:bg-neutral-800 transition-all"
                >
                  See pricing →
                </a>
                <Link
                  href="/book"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg border border-brand-border text-brand-text text-sm font-semibold bg-white/80 backdrop-blur-sm hover:bg-neutral-50 transition-all"
                >
                  Book a consultation
                </Link>
              </div>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-muted">
                {['Free Google Business audit', 'One-time and monthly options', 'Cancel Marketing Partner anytime'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft border border-brand-border text-[11px] font-bold text-accent" aria-hidden>
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
              <div className="relative rounded-3xl border border-brand-border bg-white/90 backdrop-blur-sm shadow-sm overflow-hidden">
                <HeroHarmonyVisual />
              </div>
              <span className="sr-only">
                Decorative illustration: a small storefront growing into a city skyline along a rising path, with icons for revenue, savings, ideas, and systems.
              </span>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white" id="pillars">
          <div className="max-w-[1100px] mx-auto px-7">
            <div className="section-label">The work</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,48px)] font-extrabold leading-[1.1] text-brand-text mb-12 max-w-[640px]">
              Three pillars hold <span className="gold-text">the marketing practice</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {pillars.map((item) => (
                <article
                  key={item.title}
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
                    <h3 className="text-lg font-bold text-brand-text mb-2">{item.title}</h3>
                    <p className="text-sm text-brand-muted leading-relaxed">{item.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-brand-bg-soft" id="packages">
          <div className="max-w-[1100px] mx-auto px-7">
            <div className="section-label">Ways to work together</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,48px)] font-extrabold leading-[1.1] text-brand-text mb-4 max-w-[680px]">
              The right package depends on <span className="gold-text">stage and reach</span>
            </h2>
            <p className="text-[15px] text-brand-muted leading-relaxed mb-12 max-w-[600px]">
              Business Essentials builds the brand. Business Launch adds a website and launch assets. Marketing Partner keeps the momentum going. Custom Solutions handles anything specialized. Hands-on support and reach both rise as the engagement grows.
            </p>
            <Packages />
          </div>
        </section>

        <section className="relative overflow-hidden py-24 bg-brand-text text-white" id="how">
          <div className="absolute -top-40 -right-32 w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(184,148,63,0.22)_0%,transparent_70%)] pointer-events-none" />
          <div className="relative max-w-[1100px] mx-auto px-7">
            <div className="section-label">How it works</div>
            <h2 className="font-serif text-[clamp(30px,4.6vw,48px)] font-extrabold leading-[1.1] mb-16 max-w-[640px]">
              From first audit to <span className="italic text-accent">a steady rhythm</span>
            </h2>
            <ol className="relative grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6">
              <div
                className="hidden md:block absolute left-[6%] right-[6%] top-[27px] border-t border-dashed border-white/25"
                aria-hidden
              />
              {processSteps.map((step) => (
                <li key={step.title} className="relative">
                  <div className="relative z-10 mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-accent bg-brand-text font-serif text-xl font-extrabold text-accent">
                    {step.num}
                  </div>
                  <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                  <p className="text-sm text-white/65 leading-relaxed">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="py-20 bg-white" id="faq">
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

      </main>
      <Footer />
    </>
  )
}

