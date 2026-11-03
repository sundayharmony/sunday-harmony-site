/** Google Ads account + lead conversion actions (public IDs). */
export const GOOGLE_ADS_ID = 'AW-18542732062'
/** Submit lead form — click / event snippet */
export const GOOGLE_ADS_LEAD_CONVERSION = 'AW-18542732062/vVpbCNy496wdEJ7G7olf'
/** Submit lead form (1) — conversion page / thank-you event snippet */
export const GOOGLE_ADS_LEAD_CONVERSION_PAGE = 'AW-18542732062/WxnYCL6iga0dEJ7G7olF'

type GtagFn = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: GtagFn
  }
}

function fireConversion(sendTo: string): void {
  if (typeof window === 'undefined') return
  const gtag = window.gtag
  if (typeof gtag !== 'function') return
  gtag('event', 'conversion', {
    send_to: sendTo,
    value: 1.0,
    currency: 'USD',
  })
}

/**
 * Fire lead conversions after a successful public lead action.
 * Inline thank-you states act as the conversion page (no separate URL).
 */
export function reportGoogleAdsLeadConversion(): void {
  fireConversion(GOOGLE_ADS_LEAD_CONVERSION)
  fireConversion(GOOGLE_ADS_LEAD_CONVERSION_PAGE)
}
