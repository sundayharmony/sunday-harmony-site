export const REFERRAL_COOKIE_NAME = 'sh_ref'
export const REFERRAL_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
export const REFERRAL_CODE_LENGTH = 8
export const DEFAULT_COMMISSION_CENTS = 5000
export const DEFAULT_ATTRIBUTION_DAYS = 60
export const DEFAULT_HOLD_DAYS = 0

export const COMMISSION_STATUSES = [
  'pending',
  'available',
  'processing',
  'paid',
  'cancelled',
  'revoked',
] as const
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number]

export const PAYOUT_STATUSES = ['requested', 'processing', 'paid', 'failed'] as const
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number]

export const REFERRAL_STATUSES = ['attributed', 'submitted', 'accepted', 'paid', 'cancelled'] as const
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number]

export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const cleaned = raw.trim().toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (cleaned.length < 6 || cleaned.length > 16) return null
  return cleaned
}

export function generateReferralCode(randomBytes: (n: number) => Uint8Array): string {
  const bytes = randomBytes(REFERRAL_CODE_LENGTH)
  let out = ''
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    out += REFERRAL_CODE_ALPHABET[bytes[i]! % REFERRAL_CODE_ALPHABET.length]
  }
  return out
}

export function referralCommissionCents(): number {
  const raw = process.env.CREDIT_REPAIR_REFERRAL_COMMISSION_CENTS?.trim()
  if (!raw) return DEFAULT_COMMISSION_CENTS
  const cents = Number.parseInt(raw, 10)
  if (!Number.isInteger(cents) || cents < 100 || cents > 1_000_000) return DEFAULT_COMMISSION_CENTS
  return cents
}

export function referralAttributionDays(): number {
  const raw = process.env.CREDIT_REPAIR_REFERRAL_ATTRIBUTION_DAYS?.trim()
  if (!raw) return DEFAULT_ATTRIBUTION_DAYS
  const days = Number.parseInt(raw, 10)
  if (!Number.isInteger(days) || days < 1 || days > 365) return DEFAULT_ATTRIBUTION_DAYS
  return days
}

export function referralHoldDays(): number {
  const raw = process.env.CREDIT_REPAIR_REFERRAL_HOLD_DAYS?.trim()
  if (!raw) return DEFAULT_HOLD_DAYS
  const days = Number.parseInt(raw, 10)
  if (!Number.isInteger(days) || days < 0 || days > 90) return DEFAULT_HOLD_DAYS
  return days
}

export function referralAttributionTtlMs(): number {
  return referralAttributionDays() * 24 * 60 * 60 * 1000
}

export function buildReferralPath(code: string): string {
  return `/credit-funding?ref=${encodeURIComponent(code)}`
}

/** Only /credit-funding paths, with `ref` stripped so attribution is cookie-only after landing. */
export function safeReferralLandingPath(raw: unknown): string {
  if (typeof raw !== 'string') return '/credit-funding'
  const path = raw.trim()
  if (!path.startsWith('/credit-funding')) return '/credit-funding'
  if (path.startsWith('//') || path.includes('..') || path.includes('\\')) return '/credit-funding'
  try {
    const u = new URL(path, 'https://placeholder.invalid')
    if (u.origin !== 'https://placeholder.invalid') return '/credit-funding'
    if (u.pathname !== '/credit-funding' && !u.pathname.startsWith('/credit-funding/')) {
      return '/credit-funding'
    }
    u.searchParams.delete('ref')
    const qs = u.searchParams.toString()
    return `${u.pathname}${qs ? `?${qs}` : ''}`
  } catch {
    return '/credit-funding'
  }
}

export function maskApplicantName(fullName: string | null | undefined): string {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Applicant'
  const first = parts[0] || 'Applicant'
  if (parts.length === 1) return first
  const lastInitial = (parts[parts.length - 1] || '').charAt(0).toUpperCase()
  return lastInitial ? `${first} ${lastInitial}.` : first
}

export function formatCommissionCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function publicCommissionLabel(status: string | null | undefined, amountCents: number | null): string {
  if (!amountCents || amountCents <= 0) return '—'
  if (!status || status === 'cancelled' || status === 'revoked') return '—'
  return formatCommissionCents(amountCents)
}

export function isQualifyingRepairPayment(input: {
  billingModel?: string | null
  invoiceBillingModel?: string | null
  hasSubscription?: boolean
}): boolean {
  if (input.hasSubscription) return false
  return (
    input.invoiceBillingModel === 'credit_repair_one_time' ||
    input.billingModel === 'credit_repair_one_time'
  )
}

export function shouldCreateCommission(input: {
  alreadyHasCommission: boolean
  referrerDisabled: boolean
  isSelfReferral: boolean
  isQualifyingPayment: boolean
}): boolean {
  if (input.alreadyHasCommission) return false
  if (input.referrerDisabled) return false
  if (input.isSelfReferral) return false
  return input.isQualifyingPayment
}

export function nextCommissionStatusAfterHold(availableAtIso: string, nowMs = Date.now()): CommissionStatus {
  const availableAt = Date.parse(availableAtIso)
  if (!Number.isFinite(availableAt) || availableAt > nowMs) return 'pending'
  return 'available'
}

export type AttributionPayload = {
  code: string
  profileId: string
  issuedAt: number
}
