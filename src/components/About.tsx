import { aboutValues } from '@/lib/data'
import BrandLogo from '@/components/BrandLogo'
import SectionHeader from '@/components/ui/SectionHeader'

export default function About() {
  return (
      <section className="py-24" id="about">
        <div className="max-w-[1100px] mx-auto px-7">
        <SectionHeader
          label="About Us"
          title={
            <>
              We&apos;re the partner <span className="gold-text">you&apos;ve been looking for</span>
            </>
          }
        />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center mt-12">
            <div>
              <h3 className="font-serif text-[28px] font-bold text-brand-text mb-4">
                The business should feel clear
              </h3>
              <p className="text-[15px] text-brand-muted mb-4 leading-relaxed">
                Sunday Harmony helps owners clarify the brand, decide what to do next, and put systems in place so the business can run with a plan. Consulting is how we build that.
              </p>
              <p className="text-[15px] text-brand-muted mb-7 leading-relaxed">
                We speak plain English, we show our work, and we treat every client like our only client. When an owner needs capital, or someone wants a clear read on their credit, those are separate doors with their own next step.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {aboutValues.map((val) => (
                  <div key={val.title} className="bg-white border border-brand-border rounded-xl p-4">
                    <div className="text-xl mb-2">{val.icon}</div>
                    <h4 className="text-sm font-bold text-brand-text mb-1">{val.title}</h4>
                    <p className="text-xs text-brand-dim leading-snug">{val.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-brand-border rounded-[20px] overflow-hidden aspect-square flex items-center justify-center">
              <div className="w-full h-full bg-gradient-to-br from-neutral-50 to-neutral-100 flex flex-col items-center justify-center p-10">
                <BrandLogo height={120} href={null} />
              </div>
            </div>
          </div>
        </div>
      </section>
  )
}
