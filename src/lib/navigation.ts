export interface SiteNavLink {
  label: string
  href: string
  shortLabel?: string
  hideBelow?: 'lg'
}

export const siteNavLinks: SiteNavLink[] = [
  { label: 'Contact', href: '/contact' },
  { label: 'Funding', href: '/funding' },
  { label: 'Repair Credit', href: '/credit' },
  { label: 'About', href: '/about', hideBelow: 'lg' },
]

export const siteFooterExtraLinks: SiteNavLink[] = [
  { label: 'Privacy Policy', href: '/credit/privacy' },
]
