export interface SiteNavLink {
  label: string
  href: string
  shortLabel?: string
  hideBelow?: 'lg'
}

export const siteNavLinks: SiteNavLink[] = [
  { label: 'Services', href: '/#services' },
  { label: 'Packages', href: '/#packages' },
  { label: 'About', href: '/#about', hideBelow: 'lg' },
  { label: 'Contact', href: '/#contact' },
]

export const creditFundingNavLinks: SiteNavLink[] = [
  { label: 'Business funding', href: '/credit-funding?focus=funding' },
  { label: 'Personal credit', href: '/credit-funding?focus=credit' },
]

export const siteFooterExtraLinks: SiteNavLink[] = [
  { label: 'Privacy Policy', href: '/credit-funding/privacy' },
]
