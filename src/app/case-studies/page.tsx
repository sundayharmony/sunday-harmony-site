import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import CaseStudiesViewer from '@/components/case-studies/CaseStudiesViewer'

export const metadata: Metadata = {
  title: 'Case Studies | Sunday Harmony',
  description:
    'See real client results from Sunday Harmony — marketing case studies showcasing growth, strategy, and measurable outcomes.',
}

export default function CaseStudiesPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[var(--nav-total-height)] min-h-screen bg-brand-bg-soft">
        <section className="py-16 sm:py-20">
          <div className="max-w-[1100px] mx-auto px-7">
            <div className="section-label">Results</div>
            <h1 className="font-serif text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.12] text-brand-text mb-4">
              Client <span className="gold-text">Case Studies</span>
            </h1>
            <p className="text-[15px] text-brand-muted mb-10 leading-relaxed max-w-[640px]">
              Explore one-page snapshots of how we help New Jersey businesses grow — real strategies, real outcomes, and the work behind the results.
            </p>
            <CaseStudiesViewer />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
