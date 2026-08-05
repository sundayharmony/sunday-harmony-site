import { siteConfig } from '@/lib/data'

/** Production / configured public origin (no trailing slash). */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || siteConfig.url
  return raw.replace(/\/$/, '')
}

export const DEFAULT_TITLE = `${siteConfig.name} | ${siteConfig.tagline}`

export const DEFAULT_DESCRIPTION =
  'Sunday Harmony helps businesses stop guessing at marketing and start growing. Social media, SEO, Google Ads, and more — one partner who handles it all.'

export const DEFAULT_OG_DESCRIPTION =
  'We help businesses get found online, generate leads, and grow revenue.'

export const NO_INDEX = { index: false, follow: false } as const

/** Absolute path helper for canonicals and Open Graph URLs. */
export function absoluteUrl(path = '/'): string {
  const base = getSiteUrl()
  if (!path || path === '/') return base
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.name,
    url: getSiteUrl(),
    email: siteConfig.email,
    logo: absoluteUrl('/logo-black.png'),
  }
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: getSiteUrl(),
    description: DEFAULT_DESCRIPTION,
    publisher: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: getSiteUrl(),
    },
  }
}
