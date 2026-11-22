/**
 * First-touch ad attribution. The landing page is often not the page with the form,
 * so ad parameters are kept in a first-party cookie for 30 days.
 */
export const ATTRIBUTION_COOKIE = 'sh_attr'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'] as const

export type LeadAttribution = Partial<Record<(typeof KEYS)[number], string>>

export function attributionFromParams(params: URLSearchParams): LeadAttribution | null {
  const out: LeadAttribution = {}
  for (const key of KEYS) {
    const value = params.get(key)?.trim()
    if (value) out[key] = value.slice(0, 200)
  }
  return Object.keys(out).length ? out : null
}

export function isPaidAttribution(attr: LeadAttribution | null): boolean {
  if (!attr) return false
  return Boolean(attr.gclid || attr.fbclid || /cpc|ppc|paid|display/i.test(attr.utm_medium ?? ''))
}

export function readAttributionCookie(cookie: string): LeadAttribution | null {
  const raw = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ATTRIBUTION_COOKIE}=`))
  if (!raw) return null
  try {
    return attributionFromParams(new URLSearchParams(decodeURIComponent(raw.slice(ATTRIBUTION_COOKIE.length + 1))))
  } catch {
    return null
  }
}

/** First touch wins, except a paid click replaces an earlier unpaid one (e.g. a newsletter link). */
export function shouldSaveTouch(saved: LeadAttribution | null, next: LeadAttribution | null): boolean {
  if (!next) return false
  if (!saved) return true
  return isPaidAttribution(next) && !isPaidAttribution(saved)
}

export function encodeAttribution(attr: LeadAttribution): string {
  return encodeURIComponent(new URLSearchParams(attr as Record<string, string>).toString())
}

/** Save ad parameters from the current URL, keeping the first touch. */
export function captureFirstTouch(): void {
  if (typeof window === 'undefined') return
  const attr = attributionFromParams(new URLSearchParams(window.location.search))
  if (!attr || !shouldSaveTouch(readAttributionCookie(document.cookie), attr)) return
  const value = encodeAttribution(attr)
  document.cookie = `${ATTRIBUTION_COOKIE}=${value}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax; Secure`
}

/** Ads from this URL or the saved first touch. */
export function currentVisitIsPaid(): boolean {
  if (typeof window === 'undefined') return false
  return (
    isPaidAttribution(attributionFromParams(new URLSearchParams(window.location.search))) ||
    isPaidAttribution(readAttributionCookie(document.cookie))
  )
}
