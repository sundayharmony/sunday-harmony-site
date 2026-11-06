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

/** Business funding intake. Partner links land here with the form first. */
export const FUNDING_INTAKE_PATH = '/funding'

/** Partner links add this so the funding page opens the intake before the guide. */
export const PARTNER_INTAKE_FIRST_PARAM = 'apply'

export function partnerIntakeFirstPath(code: string): string {
  const normalized = normalizeReferralCode(code)
  if (!normalized) return ''
  return `${FUNDING_INTAKE_PATH}?ref=${encodeURIComponent(normalized)}&${PARTNER_INTAKE_FIRST_PARAM}=1`
}

/** Send a partner click to the funding intake, form first, and keep an invite token. */
export function appendPartnerIntakeFirst(path: string): string {
  const safe = safeReferralLandingPath(path)
  try {
    const url = new URL(safe, 'https://placeholder.invalid')
    const params = new URLSearchParams()
    const invite = url.searchParams.get('invite')
    if (invite) params.set('invite', invite)
    params.set(PARTNER_INTAKE_FIRST_PARAM, '1')
    return `${FUNDING_INTAKE_PATH}?${params.toString()}`
  } catch {
    return `${FUNDING_INTAKE_PATH}?${PARTNER_INTAKE_FIRST_PARAM}=1`
  }
}

export function isPartnerIntakeFirst(value: unknown): boolean {
  return value === '1'
}

/** Only public credit intake paths, with `ref` stripped so attribution is cookie-only after landing. */
export function safeReferralLandingPath(raw: unknown): string {
  if (typeof raw !== 'string') return CREDIT_INTAKE_PATH
  const path = raw.trim()
  if (path.startsWith('//') || path.includes('..') || path.includes('\\')) return CREDIT_INTAKE_PATH
  try {
    const u = new URL(path, 'https://placeholder.invalid')
    if (u.origin !== 'https://placeholder.invalid') return CREDIT_INTAKE_PATH
    const fundingLanding = u.pathname === FUNDING_INTAKE_PATH
    const normalizedPath = fundingLanding ? FUNDING_INTAKE_PATH : normalizePublicCreditPath(u.pathname)
    if (!fundingLanding && !isPublicCreditIntakePath(u.pathname)) return CREDIT_INTAKE_PATH
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

/** Admin-entered referral payouts. Matches the commission ceiling so a typo cannot send a huge transfer. */
export const MAX_MANUAL_PAYOUT_CENTS = 1_000_000

export function parseManualPayoutAmount(
  raw: unknown
): { ok: true; amountCents: number } | { ok: false; error: string } {
  const missing = 'Enter the payout amount. This screen does not choose an amount for you.'
  if (raw == null) return { ok: false, error: missing }

  let dollars: number
  if (typeof raw === 'number') {
    dollars = raw
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim().replace(/^\$/, '').replace(/,/g, '')
    if (!trimmed) return { ok: false, error: missing }
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      return { ok: false, error: 'Enter a dollar amount with up to two decimal places.' }
    }
    dollars = Number(trimmed)
  } else {
    return { ok: false, error: missing }
  }

  if (!Number.isFinite(dollars) || dollars <= 0) {
    return { ok: false, error: 'Enter a payout amount greater than zero.' }
  }
  const cents = Math.round(dollars * 100)
  if (Math.abs(dollars * 100 - cents) > 0.001) {
    return { ok: false, error: 'Enter a dollar amount with up to two decimal places.' }
  }
  if (cents < 1) return { ok: false, error: 'Enter a payout amount greater than zero.' }
  if (cents > MAX_MANUAL_PAYOUT_CENTS) {
    return { ok: false, error: 'Enter an amount of $10,000 or less.' }
  }
  return { ok: true, amountCents: cents }
}

export function parsePayoutIdempotencyKey(
  raw: unknown
): { ok: true; key: string } | { ok: false; error: string } {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'Missing payout idempotency key.' }
  }
  const key = raw.trim()
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(key)) {
    return { ok: false, error: 'Invalid payout idempotency key.' }
  }
  return { ok: true, key }
}

export type PayoutDestinationCheck = {
  connectAccountId: string | null
  payoutReady: boolean
  payoutsEnabled?: boolean
  detailsSubmitted?: boolean
  transfersActive?: boolean
  hasExternalAccount?: boolean
  /** Site or Stripe error that blocks the send before a transfer is created. */
  configurationError?: string | null
}

/** Specific Stripe Connect setup the admin still needs. Null when a transfer can be attempted. */
export function payoutDestinationSetup(dest: PayoutDestinationCheck): string | null {
  if (dest.configurationError) return dest.configurationError
  if (!dest.connectAccountId) {
    return 'This client has no Stripe payout destination. Ask them to sign in, open Referrals, and choose Set up payouts. Stripe Connect collects their bank account. This site does not collect card or bank numbers. No payout was recorded.'
  }
  if (dest.transfersActive === false) {
    return 'Stripe Connect is started, but transfers are not active on this client’s account. Ask them to open Referrals and choose Continue payout setup until Stripe enables transfers. No payout was recorded.'
  }
  if (dest.payoutsEnabled === false && dest.hasExternalAccount === false) {
    return 'This client’s Stripe account has no bank account. Ask them to open Referrals and finish payout setup so Stripe has a bank to pay. No payout was recorded.'
  }
  if (dest.payoutsEnabled === false || (dest.payoutsEnabled === undefined && !dest.payoutReady)) {
    return 'Payouts are not enabled for this client. They still need to finish Stripe Connect setup (identity and bank account) from Referrals in their client dashboard. No payout was recorded.'
  }
  if (dest.detailsSubmitted === false) {
    return 'This client has not submitted the Stripe payout details. Ask them to open Referrals and finish payout setup. No payout was recorded.'
  }
  return null
}

export function payoutStatusAfterTransfer(
  result: { ok: true; stripeId: string } | { ok: false; reason: string }
):
  | { status: 'paid'; paid: true; providerTransactionId: string }
  | { status: 'failed'; paid: false; failureReason: string } {
  if (!result.ok) {
    const reason = result.reason.trim() || 'Stripe did not create a transfer.'
    return { status: 'failed', paid: false, failureReason: reason }
  }
  const stripeId = result.stripeId.trim()
  if (!/^tr_[A-Za-z0-9]+$/.test(stripeId)) {
    return {
      status: 'failed',
      paid: false,
      failureReason: 'Stripe did not return a transfer id, so the referrer was not marked paid.',
    }
  }
  return { status: 'paid', paid: true, providerTransactionId: stripeId }
}

export function transferFailureMessage(reason: string): { message: string; setupRequired: boolean } {
  const lower = reason.toLowerCase()
  if (lower.includes('insufficient') && lower.includes('balance')) {
    return {
      setupRequired: false,
      message:
        'Stripe could not send the payout because the Sunday Harmony balance does not cover this amount. Add funds in the Stripe Dashboard, then send again. The referrer was not marked paid.',
    }
  }
  if (
    lower.includes('destination') ||
    lower.includes('external account') ||
    lower.includes('capabilities') ||
    lower.includes('payouts')
  ) {
    return {
      setupRequired: true,
      message: `${reason} Ask the client to finish payout setup from Referrals in their dashboard. The referrer was not marked paid.`,
    }
  }
  return {
    setupRequired: false,
    message: `${reason} The referrer was not marked paid.`,
  }
}

export type ManualPayoutLedgerRow = {
  id: string
  clientId: string
  amountCents: number
  status: PayoutStatus
  providerTransactionId: string | null
}

export type ManualPayoutSendResult =
  | {
      ok: true
      payoutId: string
      amountCents: number
      paid: true
      status: 'paid'
      stripeId: string
      alreadySent: boolean
      idempotencyConsumed: boolean
    }
  | {
      ok: false
      error: string
      statusCode: number
      paid: false
      setupRequired: boolean
      payoutId: string | null
      idempotencyConsumed: boolean
    }

export async function executeManualReferralPayout(deps: {
  clientId: string
  amountRaw: unknown
  idempotencyKeyRaw: unknown
  loadExisting: (key: string) => Promise<ManualPayoutLedgerRow | null>
  loadDestination: () => Promise<PayoutDestinationCheck>
  insertProcessing: (input: { amountCents: number; idempotencyKey: string }) => Promise<ManualPayoutLedgerRow | null>
  createTransfer: (input: {
    payoutId: string
    amountCents: number
    destination: string
    idempotencyKey: string
  }) => Promise<{ ok: true; stripeId: string } | { ok: false; reason: string }>
  recordOutcome: (
    payoutId: string,
    outcome: { status: 'paid'; stripeId: string } | { status: 'failed'; reason: string }
  ) => Promise<void>
}): Promise<ManualPayoutSendResult> {
  const amount = parseManualPayoutAmount(deps.amountRaw)
  if (!amount.ok) {
    return {
      ok: false,
      error: amount.error,
      statusCode: 400,
      paid: false,
      setupRequired: false,
      payoutId: null,
      idempotencyConsumed: false,
    }
  }
  const key = parsePayoutIdempotencyKey(deps.idempotencyKeyRaw)
  if (!key.ok) {
    return {
      ok: false,
      error: key.error,
      statusCode: 400,
      paid: false,
      setupRequired: false,
      payoutId: null,
      idempotencyConsumed: false,
    }
  }

  const mismatch = (row: ManualPayoutLedgerRow): ManualPayoutSendResult | null => {
    if (row.clientId !== deps.clientId || row.amountCents !== amount.amountCents) {
      return {
        ok: false,
        error: 'This send was already used for a different payout. Change the amount to send again.',
        statusCode: 409,
        paid: false,
        setupRequired: false,
        payoutId: row.id,
        idempotencyConsumed: true,
      }
    }
    return null
  }

  const alreadyPaid = (row: ManualPayoutLedgerRow, stripeId: string): ManualPayoutSendResult => ({
    ok: true,
    payoutId: row.id,
    amountCents: row.amountCents,
    paid: true,
    status: 'paid',
    stripeId,
    alreadySent: true,
    idempotencyConsumed: true,
  })

  let existing = await deps.loadExisting(key.key)
  if (existing) {
    const conflict = mismatch(existing)
    if (conflict) return conflict
    if (existing.status === 'paid' && existing.providerTransactionId) {
      return alreadyPaid(existing, existing.providerTransactionId)
    }
    if (existing.providerTransactionId) {
      await deps.recordOutcome(existing.id, { status: 'paid', stripeId: existing.providerTransactionId })
      return alreadyPaid(existing, existing.providerTransactionId)
    }
    if (existing.status === 'failed') {
      return {
        ok: false,
        error: 'This payout attempt already failed and was not marked paid. Edit the amount and send again to try a new payout.',
        statusCode: 409,
        paid: false,
        setupRequired: false,
        payoutId: existing.id,
        idempotencyConsumed: true,
      }
    }
  }

  const destination = await deps.loadDestination()
  const setup = payoutDestinationSetup(destination)
  if (setup) {
    if (existing && (existing.status === 'processing' || existing.status === 'requested')) {
      await deps.recordOutcome(existing.id, { status: 'failed', reason: setup })
    }
    return {
      ok: false,
      error: setup,
      statusCode: 400,
      paid: false,
      setupRequired: true,
      payoutId: existing?.id || null,
      idempotencyConsumed: Boolean(existing),
    }
  }

  if (!destination.connectAccountId) {
    return {
      ok: false,
      error: 'This client has no Stripe payout destination. No payout was recorded.',
      statusCode: 400,
      paid: false,
      setupRequired: true,
      payoutId: null,
      idempotencyConsumed: false,
    }
  }

  let row = existing
  if (!row) {
    row = await deps.insertProcessing({ amountCents: amount.amountCents, idempotencyKey: key.key })
    if (!row) {
      return {
        ok: false,
        error: 'Could not record the payout attempt, so Stripe was not charged.',
        statusCode: 500,
        paid: false,
        setupRequired: false,
        payoutId: null,
        idempotencyConsumed: false,
      }
    }
    const conflict = mismatch(row)
    if (conflict) return conflict
    if (row.status === 'paid' && row.providerTransactionId) {
      return alreadyPaid(row, row.providerTransactionId)
    }
    if (row.providerTransactionId) {
      await deps.recordOutcome(row.id, { status: 'paid', stripeId: row.providerTransactionId })
      return alreadyPaid(row, row.providerTransactionId)
    }
    if (row.status === 'failed') {
      return {
        ok: false,
        error: 'This payout attempt already failed and was not marked paid.',
        statusCode: 409,
        paid: false,
        setupRequired: false,
        payoutId: row.id,
        idempotencyConsumed: true,
      }
    }
  }

  const transfer = await deps.createTransfer({
    payoutId: row.id,
    amountCents: amount.amountCents,
    destination: destination.connectAccountId,
    idempotencyKey: key.key,
  })
  const outcome = payoutStatusAfterTransfer(transfer)
  if (outcome.status === 'paid') {
    await deps.recordOutcome(row.id, { status: 'paid', stripeId: outcome.providerTransactionId })
    return {
      ok: true,
      payoutId: row.id,
      amountCents: amount.amountCents,
      paid: true,
      status: 'paid',
      stripeId: outcome.providerTransactionId,
      alreadySent: false,
      idempotencyConsumed: true,
    }
  }

  await deps.recordOutcome(row.id, { status: 'failed', reason: outcome.failureReason })
  const failure = transferFailureMessage(outcome.failureReason)
  return {
    ok: false,
    error: failure.message,
    statusCode: 502,
    paid: false,
    setupRequired: failure.setupRequired,
    payoutId: row.id,
    idempotencyConsumed: true,
  }
}
