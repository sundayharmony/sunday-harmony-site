export interface SiteNavLink {
  label: string
  href: string
  shortLabel?: string
  hideBelow?: 'lg'
}

/** True when this public nav link matches the current path (excludes /credit/privacy). */
export function isSiteNavLinkActive(href: string, pathname: string): boolean {
  const path = pathname.split('?')[0]
  if (href === '/credit') return path === '/credit'
  return path === href
}

export const siteNavLinks: SiteNavLink[] = [
  { label: 'Services', href: '/services' },
  { label: 'Contact', href: '/contact' },
  { label: 'Funding', href: '/funding' },
  { label: 'Build Credit', href: '/credit' },
  { label: 'About', href: '/about', hideBelow: 'lg' },
]

export const siteFooterExtraLinks: SiteNavLink[] = [
  { label: 'Privacy Policy', href: '/credit/privacy' },
]
