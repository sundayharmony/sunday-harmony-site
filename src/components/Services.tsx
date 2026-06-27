import { services } from '@/lib/data'
import SectionHeader from '@/components/ui/SectionHeader'

export default function Services() {
  return (
    <section className="py-24 bg-brand-bg-soft" id="services">
      <div className="max-w-[1100px] mx-auto px-7">
        <SectionHeader
          label="What We Do"
          title={
            <>
              <span className="gold-text">Everything your business needs</span> to grow online
            </>
          }
          description="From social media to Google Ads to physical marketing — we're your all-in-one team so you can focus on running your business."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
          {services.map((service) => (
            <div
              key={service.title}
              className="bg-white border border-brand-border rounded-2xl p-9 transition-all hover:shadow-sm hover:border-neutral-300 hover:-translate-y-0.5"
            >
              <div className="w-12 h-12 rounded-xl bg-accent-soft border border-brand-border flex items-center justify-center text-[22px] mb-5">
                {service.icon}
              </div>
              <h3 className="text-lg font-bold text-brand-text mb-2.5">{service.title}</h3>
              <p className="text-sm text-brand-muted leading-relaxed">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
