import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ConsultationBooker from '@/components/contact/ConsultationBooker'

export const metadata: Metadata = {
  title: 'Book a consultation',
  description: 'Pick a day, then a time, for a Sunday Harmony consultation on Google Meet.',
  alternates: { canonical: '/book' },
  openGraph: {
    title: 'Book a consultation | Sunday Harmony',
    description: 'Choose an open day, then a time. We email the Google Meet link right away.',
    url: '/book',
  },
}

export default function BookConsultationPage() {
  return (
    <>
      <Navbar />
      <main id="main" className="pt-[var(--nav-total-height)]">
        <section className="py-16 sm:py-20 bg-white">
          <div className="max-w-[720px] mx-auto px-7">
            <div className="section-label">Book a consultation</div>
            <h1 className="font-serif text-[clamp(36px,5vw,56px)] font-extrabold leading-[1.05] text-brand-text mb-3">
              Pick a day. <span className="gold-text">Then a time.</span>
            </h1>
            <p className="text-[15px] text-brand-muted leading-relaxed mb-8 max-w-[520px]">
              Choose an open day first. Times for that day show next. We email the Google Meet link right away, and again the day of the conversation.
            </p>
            <ConsultationBooker />
            <p className="mt-6 text-sm text-brand-muted">
              Prefer to write?{' '}
              <a href="/contact#message" className="font-semibold text-brand-text hover:text-accent">
                Send a message
              </a>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
