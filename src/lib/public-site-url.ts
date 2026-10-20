/**
 * Base origin for public links (no trailing slash).
 * Prefer NEXTAUTH_URL, then NEXT_PUBLIC_SITE_URL.
 * Kept out of smtp-mail so client components can build referral URLs
 * without pulling nodemailer into the browser bundle.
 */
export function getPublicSiteUrl(): string {
  const raw = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').trim()
  const noTrail = raw.replace(/\/+$/, '')
  try {
    return new URL(noTrail || 'http://localhost:3000').origin
  } catch {
    return 'http://localhost:3000'
  }
}
