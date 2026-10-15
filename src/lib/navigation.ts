export interface SiteNavLink {
  label: string
  href: string
  shortLabel?: string
  hideBelow?: 'lg'
}

export const siteNavLinks: SiteNavLink[] = [
<<<<<<< HEAD
  { label: 'Services', href: '/' },
  { label: 'Packages', href: '/#packages' },
  { label: 'Personal Credit', href: '/credit' },
  { label: 'About', href: '/about', hideBelow: 'lg' },
=======
  { label: 'Services', href: '/#services' },
  { label: 'Funding', href: '/funding' },
  { label: 'Repair Credit', href: '/credit' },
  { label: 'About', href: '/#about', hideBelow: 'lg' },
>>>>>>> 00db27c (Update site nav: add Funding, rename Repair Credit, drop Packages.)
  { label: 'Contact', href: '/contact' },
]

export const siteFooterExtraLinks: SiteNavLink[] = [
  { label: 'Privacy Policy', href: '/credit/privacy' },
]
