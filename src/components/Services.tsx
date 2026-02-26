import { services } from '@/lib/data'

export default function Services() {
  return (
    <section className="py-24 bg-brand-bg-soft" id="services">
      <div className="max-w-[1100px] mx-auto px-7">
        <div className="section-label">What We Do</div>
        <h2 className="font-serif text-[clamp(32px,5vw,52px)] font-extrabold leading-[1.12] text-brand-text mb-5">
          <span className="gold-text">Everything your business needs</span> to grow online
        </h2>
        <p className="text-[17px] text-brand-muted max-w-[580px] leading-relaxed">
          From social media to Google Ads to physical marketing &mdash; we&apos;re your all-in-one team so you can focus on running your business.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
          {services.map((service) => (
            <div
              key={service.title}
              className="bg-white border border-brand-border rounded-2xl p-9 transition-all hover:shadow-md hover:border-[rgba(184,148,63,0.25)] hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-xl bg-[rgba(184,148,63,0.08)] border border-[rgba(184,148,63,0.15)] flex items-center justify-center text-[22px] mb-5">
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
