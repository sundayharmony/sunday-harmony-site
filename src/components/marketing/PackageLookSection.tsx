import MarketingImageGallery from '@/components/marketing/MarketingImageGallery'
import { marketingImagesFor } from '@/lib/marketing-images'

const packageGalleries = [
  {
    section: 'business-essentials' as const,
    title: 'Business Essentials',
    description: 'Brand identity samples — logos, stationery, and guidelines.',
  },
  {
    section: 'business-launch' as const,
    title: 'Business Launch',
    description: 'Website and launch-ready brand presence.',
  },
  {
    section: 'marketing-partner' as const,
    title: 'Marketing Partner',
    description: 'Ongoing social, campaigns, and presence work.',
  },
  {
    section: 'custom-solutions' as const,
    title: 'Custom Solutions',
    description: 'Print, apparel, wraps, events, and specialized builds.',
  },
]

export default function PackageLookSection() {
  return (
    <section className="py-20 bg-white" id="package-look" aria-labelledby="package-look-heading">
      <div className="max-w-[1100px] mx-auto px-7 space-y-16">
        <div className="max-w-[680px]">
          <div className="section-label">The look</div>
          <h2
            id="package-look-heading"
            className="font-serif text-[clamp(30px,4.6vw,48px)] font-extrabold leading-[1.1] text-brand-text"
          >
            What the work can <span className="gold-text">look like</span>
          </h2>
          <p className="mt-4 text-[15px] text-brand-muted leading-relaxed">
            Original visuals for each package. Display is capped — these are samples, not full-bleed heroes.
          </p>
        </div>
        {packageGalleries.map((gallery) => (
          <MarketingImageGallery
            key={gallery.section}
            id={`look-${gallery.section}`}
            title={gallery.title}
            description={gallery.description}
            images={marketingImagesFor(gallery.section)}
          />
        ))}
      </div>
    </section>
  )
}
