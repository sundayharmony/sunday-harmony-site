export interface SiteNavLink {
  label: string
  href: string
  shortLabel?: string
  hideBelow?: 'lg'
}

export const siteNavLinks: SiteNavLink[] = [
  { label: 'Funding', href: '/funding' },
  { label: 'Repair Credit', href: '/credit' },
  { label: 'About', href: '/about', hideBelow: 'lg' },
  { label: 'Contact', href: '/contact' },
]

export const siteFooterExtraLinks: SiteNavLink[] = [
  { label: 'Privacy Policy', href: '/credit/privacy' },
]
