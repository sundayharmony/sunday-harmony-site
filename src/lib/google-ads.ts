/** Google Ads account + "Submit lead form" conversion action (public IDs). */
export const GOOGLE_ADS_ID = 'AW-18542732062'
export const GOOGLE_ADS_LEAD_CONVERSION = 'AW-18542732062/vVpbCNy496wdEJ7G7olf'

type GtagFn = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: GtagFn
  }
}

/** Fire the Submit lead form conversion after a successful public lead action. */
export function reportGoogleAdsLeadConversion(): void {
  if (typeof window === 'undefined') return
  const gtag = window.gtag
  if (typeof gtag !== 'function') return
  gtag('event', 'conversion', {
    send_to: GOOGLE_ADS_LEAD_CONVERSION,
    value: 1.0,
    currency: 'USD',
  })
}
