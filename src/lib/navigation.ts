export interface SiteNavLink {
  label: string
  href: string
  shortLabel?: string
  hideBelow?: 'lg'
}

export const siteNavLinks: SiteNavLink[] = [
<<<<<<< HEAD
  { label: 'Services', href: '/' },
  { label: 'Funding', href: '/funding' },
  { label: 'Repair Credit', href: '/credit' },
=======
  { label: 'Packages', href: '/#packages' },
  { label: 'Personal Credit', href: '/credit' },
>>>>>>> 0846462 (Remove Services link from site navigation)
  { label: 'About', href: '/about', hideBelow: 'lg' },
  { label: 'Contact', href: '/contact' },
]

export const siteFooterExtraLinks: SiteNavLink[] = [
  { label: 'Privacy Policy', href: '/credit/privacy' },
]
