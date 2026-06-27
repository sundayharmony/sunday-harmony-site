export interface SiteNavLink {
  label: string
  href: string
  shortLabel?: string
  hideBelow?: 'lg'
}

export const siteNavLinks: SiteNavLink[] = [
  { label: 'Services', href: '/#services' },
  { label: 'Packages', href: '/#packages' },
  { label: 'Case Studies', href: '/case-studies' },
  { label: 'Credit & Funding', href: '/credit-funding', shortLabel: 'Credit' },
  { label: 'About', href: '/#about', hideBelow: 'lg' },
  { label: 'Contact', href: '/#contact' },
]

export const siteFooterExtraLinks: SiteNavLink[] = [
  { label: 'Privacy Policy', href: '/credit-funding/privacy' },
]
