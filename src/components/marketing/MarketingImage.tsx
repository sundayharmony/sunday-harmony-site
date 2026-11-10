import Image from 'next/image'
import type { MarketingImage as MarketingImageData } from '@/lib/marketing-images'

/** Cap display so ~1024–1280px assets never go full-bleed. */
export const MARKETING_IMAGE_MAX_WIDTH_PX = 720

type Props = {
  image: MarketingImageData
  priority?: boolean
  className?: string
  sizes?: string
}

export default function MarketingImage({
  image,
  priority = false,
  className = '',
  sizes = `(max-width: 640px) 100vw, ${MARKETING_IMAGE_MAX_WIDTH_PX}px`,
}: Props) {
  return (
    <figure
      className={`mx-auto w-full overflow-hidden rounded-2xl border border-brand-border bg-white ${className}`}
      style={{ maxWidth: MARKETING_IMAGE_MAX_WIDTH_PX }}
    >
      <Image
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        className="block h-auto w-full"
      />
    </figure>
  )
}
