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
  { label: 'Market', href: '/services' },
  { label: 'Fund', href: '/funding' },
  { label: 'Build', href: '/credit' },
  { label: 'Contact', href: '/contact' },
  { label: 'About', href: '/about' },
]

export const siteFooterExtraLinks: SiteNavLink[] = [
  { label: 'Privacy Policy', href: '/credit/privacy' },
]
