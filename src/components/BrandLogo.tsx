import Image from 'next/image'
import Link from 'next/link'

const LOGO_ASPECT = 991 / 587

type BrandLogoProps = {
  variant?: 'black' | 'white'
  height?: number
  href?: string | null
  className?: string
  priority?: boolean
}

export default function BrandLogo({
  variant = 'black',
  height = 40,
  href = '/',
  className = '',
  priority = false,
}: BrandLogoProps) {
  const src = variant === 'white' ? '/logo-white.png' : '/logo-black.png'
  const width = Math.round(height * LOGO_ASPECT)

  const image = (
    <Image
      src={src}
      alt="Sunday Harmony"
      width={width}
      height={height}
      sizes={`${width}px`}
      className={`block h-auto w-auto max-w-full object-contain ${className}`}
      style={{ height, width: 'auto', maxWidth: width }}
      priority={priority}
    />
  )

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0 items-center self-center">
        {image}
      </Link>
    )
  }

  return <span className="inline-flex shrink-0 items-center">{image}</span>
}
