import { getPublicSiteUrl } from '@/lib/smtp-mail'
import { buildReferralPath, normalizeReferralCode } from '@/lib/referrals'
import { CREDIT_INTAKE_PATH, isPublicCreditIntakePath } from '@/lib/credit-intake-routes'

export const QR_SERVER_CREATE_URL = 'https://api.qrserver.com/v1/create-qr-code/'
export const DEFAULT_REFERRAL_QR_SIZE = 500

export function buildQrServerImageUrl(data: string, size = DEFAULT_REFERRAL_QR_SIZE): string {
  const trimmed = data.trim()
  if (!trimmed) return ''
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    data: trimmed,
  })
  return `${QR_SERVER_CREATE_URL}?${params.toString()}`
}

export function buildPartnerReferralUrl(code: string): string {
  const normalized = normalizeReferralCode(code)
  if (!normalized) return ''
  return `${getPublicSiteUrl()}${buildReferralPath(normalized)}`
}

/** Referral links we allow encoded in QR (same-site credit intake with ref). */
export function isAllowedReferralQrPayload(data: string): boolean {
  const trimmed = data.trim()
  if (!trimmed) return false
  try {
    const site = new URL(getPublicSiteUrl())
    const target = new URL(trimmed)
    if (target.origin !== site.origin) return false
    if (!isPublicCreditIntakePath(target.pathname) && target.pathname !== CREDIT_INTAKE_PATH) {
      return false
    }
    const ref = normalizeReferralCode(target.searchParams.get('ref'))
    return Boolean(ref)
  } catch {
    return false
  }
}

export function referralCodeFromQrPayload(data: string): string | null {
  try {
    const target = new URL(data.trim())
    return normalizeReferralCode(target.searchParams.get('ref'))
  } catch {
    return null
  }
}

export function referralQrDownloadFilename(prefix: string, code: string): string {
  const safe = (prefix || 'referral')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(0, 48)
  const c = (code || 'code').replace(/[^a-zA-Z0-9]+/g, '')
  return `${safe}-${c}-qr.png`
}
