/** Public marketing URL for personal credit intake (formerly /credit-funding). */
export const CREDIT_INTAKE_PATH = '/credit'

export const CREDIT_PRIVACY_PATH = '/credit/privacy'

const LEGACY_PREFIX = '/credit-funding'

/** Map legacy /credit-funding URLs to /credit for redirects and referral safety. */
export function normalizePublicCreditPath(pathname: string): string {
  if (pathname === LEGACY_PREFIX) return CREDIT_INTAKE_PATH
  if (pathname.startsWith(`${LEGACY_PREFIX}/`)) {
    return `${CREDIT_INTAKE_PATH}${pathname.slice(LEGACY_PREFIX.length)}`
  }
  return pathname
}

export function isPublicCreditIntakePath(pathname: string): boolean {
  return (
    pathname === CREDIT_INTAKE_PATH ||
    pathname.startsWith(`${CREDIT_INTAKE_PATH}/`) ||
    pathname === LEGACY_PREFIX ||
    pathname.startsWith(`${LEGACY_PREFIX}/`)
  )
}
