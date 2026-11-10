import MarketingImage from '@/components/marketing/MarketingImage'
import type { MarketingImage as MarketingImageData } from '@/lib/marketing-images'

type Props = {
  title: string
  description?: string
  images: MarketingImageData[]
  /** First image can load eagerly when this gallery is above the fold. */
  priorityFirst?: boolean
  id?: string
}

export default function MarketingImageGallery({
  title,
  description,
  images,
  priorityFirst = false,
  id,
}: Props) {
  if (!images.length) return null

  return (
    <section id={id} className="scroll-mt-28">
      <div className="mb-6 max-w-[640px]">
        <h3 className="font-serif text-[clamp(22px,3vw,30px)] font-extrabold text-brand-text">{title}</h3>
        {description ? (
          <p className="mt-2 text-sm text-brand-muted leading-relaxed">{description}</p>
        ) : null}
      </div>
      <ul className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((image, index) => (
          <li key={image.src} className="min-w-0 self-start">
            <MarketingImage image={image} priority={priorityFirst && index === 0} />
          </li>
        ))}
      </ul>
    </section>
  )
}
