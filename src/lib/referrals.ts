import {
  CREDIT_INTAKE_PATH,
  isPublicCreditIntakePath,
  normalizePublicCreditPath,
} from '@/lib/credit-intake-routes'

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
  return `${CREDIT_INTAKE_PATH}?ref=${encodeURIComponent(code)}`
}

/** Only public credit intake paths, with `ref` stripped so attribution is cookie-only after landing. */
export function safeReferralLandingPath(raw: unknown): string {
  if (typeof raw !== 'string') return CREDIT_INTAKE_PATH
  const path = raw.trim()
  if (path.startsWith('//') || path.includes('..') || path.includes('\\')) return CREDIT_INTAKE_PATH
  try {
    const u = new URL(path, 'https://placeholder.invalid')
    if (u.origin !== 'https://placeholder.invalid') return CREDIT_INTAKE_PATH
    const normalizedPath = normalizePublicCreditPath(u.pathname)
    if (!isPublicCreditIntakePath(u.pathname)) return CREDIT_INTAKE_PATH
    u.searchParams.delete('ref')
    const qs = u.searchParams.toString()
    return `${normalizedPath}${qs ? `?${qs}` : ''}`
  } catch {
    return CREDIT_INTAKE_PATH
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

/** One credit-repair referral, plus any commission or payout already stored for it. */
export type CreditReferralPayoutSource = {
  referralId: string
  referrerClientId: string
  referrerName: string
  code: string | null
  referredName: string
  referralStatus: string
  commissionId: string | null
  commissionStatus: string | null
  commissionAmountCents: number | null
  commissionPaidAt: string | null
  /** True when a pending commission has passed its hold and can be recorded as paid. */
  commissionReady: boolean
  payoutStatus: string | null
  payoutProcessedAt: string | null
  payoutAmountCents: number | null
  partnerProfile?: boolean
}

export type CreditReferralPayoutRow = {
  referralId: string
  referrerClientId: string
  referrerName: string
  code: string | null
  referredName: string
  /** Payout or commission status when one exists; otherwise the referral status. */
  status: string
  paid: boolean
  paidAt: string | null
  /** Recorded commission or payout amount. Null when the product has not stored one. */
  amountCents: number | null
  canMarkPaid: boolean
  commissionId: string | null
}

const RECORDED_PAYOUT_STATUSES = new Set(['requested', 'processing', 'paid', 'failed'])

const CREDIT_REFERRAL_STATUS_LABELS: Record<string, string> = {
  owed: 'Owed',
  paid: 'Paid',
  pending: 'Pending',
  processing: 'Processing',
  requested: 'Requested',
  failed: 'Failed',
  cancelled: 'Cancelled',
  revoked: 'Revoked',
  attributed: 'Attributed',
  submitted: 'Submitted',
  accepted: 'Accepted',
  applicant_paid: 'Applicant paid',
}

export function creditReferralStatusLabel(status: string): string {
  return CREDIT_REFERRAL_STATUS_LABELS[status] || status.replace(/_/g, ' ')
}

function recordedPayoutAmount(commissionAmount: number | null, payoutAmount: number | null): number | null {
  if (typeof commissionAmount === 'number' && commissionAmount > 0) return commissionAmount
  if (typeof payoutAmount === 'number' && payoutAmount > 0) return payoutAmount
  return null
}

export function describeCreditReferralPayout(
  source: CreditReferralPayoutSource
): Pick<CreditReferralPayoutRow, 'status' | 'paid' | 'paidAt' | 'amountCents' | 'canMarkPaid'> {
  const amountCents = recordedPayoutAmount(source.commissionAmountCents, source.payoutAmountCents)
  const payoutStatus =
    source.payoutStatus && RECORDED_PAYOUT_STATUSES.has(source.payoutStatus) ? source.payoutStatus : null

  if (payoutStatus === 'paid' || source.commissionStatus === 'paid') {
    return {
      status: 'paid',
      paid: true,
      paidAt: source.commissionPaidAt || source.payoutProcessedAt || null,
      amountCents,
      canMarkPaid: false,
    }
  }

  if (
    payoutStatus === 'processing' ||
    payoutStatus === 'requested' ||
    source.commissionStatus === 'processing'
  ) {
    return {
      status: payoutStatus || 'processing',
      paid: false,
      paidAt: null,
      amountCents,
      canMarkPaid: false,
    }
  }

  if (source.commissionStatus === 'cancelled' || source.commissionStatus === 'revoked') {
    return {
      status: source.commissionStatus,
      paid: false,
      paidAt: null,
      amountCents: null,
      canMarkPaid: false,
    }
  }

  const readyToRecord =
    source.commissionStatus === 'available' ||
    (source.commissionStatus === 'pending' && source.commissionReady)
  if (readyToRecord) {
    return {
      status: 'owed',
      paid: false,
      paidAt: null,
      amountCents,
      canMarkPaid: Boolean(source.commissionId) && amountCents != null,
    }
  }

  if (source.commissionStatus === 'pending') {
    return {
      status: 'pending',
      paid: false,
      paidAt: null,
      amountCents,
      canMarkPaid: false,
    }
  }

  if (payoutStatus === 'failed') {
    return {
      status: 'failed',
      paid: false,
      paidAt: null,
      amountCents,
      canMarkPaid: false,
    }
  }

  return {
    status: source.referralStatus === 'paid' ? 'applicant_paid' : source.referralStatus || 'submitted',
    paid: false,
    paidAt: null,
    amountCents: null,
    canMarkPaid: false,
  }
}

function payoutSortRank(status: string, paid: boolean): number {
  if (paid) return 5
  if (status === 'owed') return 0
  if (status === 'failed') return 1
  if (status === 'processing' || status === 'requested') return 2
  if (status === 'pending') return 3
  return 4
}

/** Client credit-repair referrals only, owed first, then other unpaid, then paid. */
export function selectCreditReferralPayouts(rows: CreditReferralPayoutSource[]): CreditReferralPayoutRow[] {
  const described = rows
    .filter((row) => row.referralId && row.referrerClientId && !row.partnerProfile)
    .map((row) => ({
      referralId: row.referralId,
      referrerClientId: row.referrerClientId,
      referrerName: row.referrerName.trim() || 'Client',
      code: row.code?.trim() || null,
      referredName: row.referredName.trim() || 'Credit client',
      commissionId: row.commissionId,
      ...describeCreditReferralPayout(row),
    }))

  described.sort((a, b) => {
    const byRank = payoutSortRank(a.status, a.paid) - payoutSortRank(b.status, b.paid)
    if (byRank !== 0) return byRank
    return a.referrerName.localeCompare(b.referrerName) || a.referredName.localeCompare(b.referredName)
  })
  return described
}

export type CreditReferralPayoutBuildInput = {
  profiles: {
    id: string
    client_id: string | null
    partner_profile_id?: string | null
    referral_code: string
  }[]
  referrals: {
    id: string
    referral_profile_id: string
    referred_application_id: string | null
    referred_client_id: string | null
    referral_status: string
  }[]
  commissions: {
    id: string
    referral_id: string
    amount_cents: number
    status: string
    paid_at: string | null
    payout_id: string | null
    available_at: string
  }[]
  payouts: {
    id: string
    status: string
    processed_at: string | null
    amount_cents: number
  }[]
  clients: { id: string; name: string }[]
  applications: { id: string; full_name: string | null }[]
  nowMs: number
}

export function buildCreditReferralPayoutSources(
  input: CreditReferralPayoutBuildInput
): CreditReferralPayoutSource[] {
  const profileById = new Map(input.profiles.map((profile) => [profile.id, profile]))
  const clientById = new Map(input.clients.map((client) => [client.id, client]))
  const commissionByReferral = new Map(input.commissions.map((row) => [row.referral_id, row]))
  const payoutById = new Map(input.payouts.map((row) => [row.id, row]))
  const appById = new Map(input.applications.map((app) => [app.id, app]))
  const sources: CreditReferralPayoutSource[] = []

  for (const referral of input.referrals) {
    const profile = profileById.get(referral.referral_profile_id)
    if (!profile?.client_id || profile.partner_profile_id) continue
    const referrer = clientById.get(profile.client_id)
    const commission = commissionByReferral.get(referral.id) || null
    const payout = commission?.payout_id ? payoutById.get(commission.payout_id) || null : null
    const referredClient = referral.referred_client_id
      ? clientById.get(referral.referred_client_id)
      : undefined
    const application = referral.referred_application_id
      ? appById.get(referral.referred_application_id)
      : undefined
    const availableAt = commission ? Date.parse(commission.available_at) : Number.NaN
    sources.push({
      referralId: referral.id,
      referrerClientId: profile.client_id,
      referrerName: referrer?.name || 'Client',
      code: profile.referral_code,
      referredName: referredClient?.name || application?.full_name || 'Credit client',
      referralStatus: referral.referral_status,
      commissionId: commission?.id || null,
      commissionStatus: commission?.status || null,
      commissionAmountCents: commission?.amount_cents ?? null,
      commissionPaidAt: commission?.paid_at || null,
      commissionReady: Number.isFinite(availableAt) && availableAt <= input.nowMs,
      payoutStatus: payout?.status || null,
      payoutProcessedAt: payout?.processed_at || null,
      payoutAmountCents: payout?.amount_cents ?? null,
      partnerProfile: false,
    })
  }

  return sources
}
