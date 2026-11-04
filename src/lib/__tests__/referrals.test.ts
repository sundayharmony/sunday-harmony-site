import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, describe, it } from 'node:test'
import {
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  buildReferralPath,
  formatCommissionCents,
  generateReferralCode,
  isQualifyingRepairPayment,
  maskApplicantName,
  nextCommissionStatusAfterHold,
  normalizeReferralCode,
  buildCreditReferralPayoutSources,
  creditReferralStatusLabel,
  publicCommissionLabel,
  referralAttributionDays,
  referralCommissionCents,
  safeReferralLandingPath,
  selectCreditReferralPayouts,
  shouldCreateCommission,
  type CreditReferralPayoutSource,
} from '../referrals'
import { signReferralAttribution, verifyReferralAttribution } from '../referral-attribution'

const originalSigning = process.env.CREDIT_FUNDING_SIGNING_SECRET
const originalCommission = process.env.CREDIT_REPAIR_REFERRAL_COMMISSION_CENTS
const originalDays = process.env.CREDIT_REPAIR_REFERRAL_ATTRIBUTION_DAYS

before(() => {
  process.env.CREDIT_FUNDING_SIGNING_SECRET = 'referral-test-signing-secret'
  process.env.CREDIT_REPAIR_REFERRAL_COMMISSION_CENTS = '5000'
  process.env.CREDIT_REPAIR_REFERRAL_ATTRIBUTION_DAYS = '60'
})

after(() => {
  if (originalSigning === undefined) delete process.env.CREDIT_FUNDING_SIGNING_SECRET
  else process.env.CREDIT_FUNDING_SIGNING_SECRET = originalSigning
  if (originalCommission === undefined) delete process.env.CREDIT_REPAIR_REFERRAL_COMMISSION_CENTS
  else process.env.CREDIT_REPAIR_REFERRAL_COMMISSION_CENTS = originalCommission
  if (originalDays === undefined) delete process.env.CREDIT_REPAIR_REFERRAL_ATTRIBUTION_DAYS
  else process.env.CREDIT_REPAIR_REFERRAL_ATTRIBUTION_DAYS = originalDays
})

describe('referral codes and display', () => {
  it('normalizes and rejects invalid referral codes', () => {
    assert.equal(normalizeReferralCode(' abc-1234 '), 'ABC1234')
    assert.equal(normalizeReferralCode('AB12'), null)
    assert.equal(normalizeReferralCode(12), null)
    assert.equal(normalizeReferralCode('short'), null)
    assert.equal(normalizeReferralCode('!!!'), null)
  })

  it('generates unambiguous codes of the expected length', () => {
    const code = generateReferralCode(n => Uint8Array.from({ length: n }, (_, i) => i + 3))
    assert.equal(code.length, REFERRAL_CODE_LENGTH)
    for (const ch of code) assert.ok(REFERRAL_CODE_ALPHABET.includes(ch))
    assert.equal(/[01IOL]/.test(code), false)
  })

  it('masks referred applicant names without exposing full last names', () => {
    assert.equal(maskApplicantName('John Doe'), 'John D.')
    assert.equal(maskApplicantName('Sarah'), 'Sarah')
    assert.equal(maskApplicantName(''), 'Applicant')
  })

  it('builds the public credit intake referral path', () => {
    assert.equal(buildReferralPath('ABC12345'), '/credit?ref=ABC12345')
    assert.equal(referralCommissionCents(), 5000)
    assert.equal(referralAttributionDays(), 60)
    assert.equal(formatCommissionCents(5000), '$50.00')
    assert.equal(publicCommissionLabel('available', 5000), '$50.00')
    assert.equal(publicCommissionLabel('not_eligible', 0), '—')
    assert.equal(publicCommissionLabel('cancelled', 5000), '—')
  })

  it('strips ref and blocks open redirects on landing paths', () => {
    assert.equal(safeReferralLandingPath('/credit?ref=ABC12345&invite=tok'), '/credit?invite=tok')
    assert.equal(safeReferralLandingPath('/credit-funding?ref=ABC12345&invite=tok'), '/credit?invite=tok')
    assert.equal(safeReferralLandingPath('https://evil.example/credit'), '/credit')
    assert.equal(safeReferralLandingPath('//evil.example'), '/credit')
    assert.equal(safeReferralLandingPath('/dashboard'), '/credit')
  })
})

describe('commission eligibility', () => {
  it('creates $50 only after a qualifying credit repair payment', () => {
    assert.equal(
      isQualifyingRepairPayment({ billingModel: 'credit_repair_one_time', hasSubscription: false }),
      true
    )
    assert.equal(
      isQualifyingRepairPayment({ invoiceBillingModel: 'credit_repair_one_time', hasSubscription: false }),
      true
    )
    assert.equal(
      isQualifyingRepairPayment({ billingModel: 'credit_repair_one_time', hasSubscription: true }),
      false
    )
    assert.equal(
      isQualifyingRepairPayment({ billingModel: 'marketing_subscription', hasSubscription: false }),
      false
    )
    assert.equal(
      shouldCreateCommission({
        alreadyHasCommission: false,
        referrerDisabled: false,
        isSelfReferral: false,
        isQualifyingPayment: true,
      }),
      true
    )
    assert.equal(
      shouldCreateCommission({
        alreadyHasCommission: true,
        referrerDisabled: false,
        isSelfReferral: false,
        isQualifyingPayment: true,
      }),
      false
    )
    assert.equal(
      shouldCreateCommission({
        alreadyHasCommission: false,
        referrerDisabled: true,
        isSelfReferral: false,
        isQualifyingPayment: true,
      }),
      false
    )
    assert.equal(
      shouldCreateCommission({
        alreadyHasCommission: false,
        referrerDisabled: false,
        isSelfReferral: true,
        isQualifyingPayment: true,
      }),
      false
    )
    assert.equal(
      shouldCreateCommission({
        alreadyHasCommission: false,
        referrerDisabled: false,
        isSelfReferral: false,
        isQualifyingPayment: false,
      }),
      false
    )
  })

  it('holds commissions until available_at, then marks them available', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const past = new Date(Date.now() - 60_000).toISOString()
    assert.equal(nextCommissionStatusAfterHold(future), 'pending')
    assert.equal(nextCommissionStatusAfterHold(past), 'available')
  })
})

describe('signed referral attribution', () => {
  it('round-trips a signed cookie payload and rejects tampering or expiry', () => {
    const payload = { code: 'ABC23456', profileId: 'profile-1', issuedAt: Date.now() }
    const token = signReferralAttribution(payload)
    assert.deepEqual(verifyReferralAttribution(token), payload)

    const tampered = `${token.slice(0, -2)}aa`
    assert.equal(verifyReferralAttribution(tampered), null)

    const expired = signReferralAttribution({
      ...payload,
      issuedAt: Date.now() - 61 * 24 * 60 * 60 * 1000,
    })
    assert.equal(verifyReferralAttribution(expired), null)
    assert.equal(verifyReferralAttribution('not-a-token'), null)
  })
})

function payoutSource(overrides: Partial<CreditReferralPayoutSource> = {}): CreditReferralPayoutSource {
  return {
    referralId: 'ref-1',
    referrerClientId: 'client-1',
    referrerName: 'Ada Lovelace',
    code: 'ADA23456',
    referredName: 'Grace Hopper',
    referralStatus: 'submitted',
    commissionId: null,
    commissionStatus: null,
    commissionAmountCents: null,
    commissionPaidAt: null,
    commissionReady: false,
    payoutStatus: null,
    payoutProcessedAt: null,
    payoutAmountCents: null,
    ...overrides,
  }
}

describe('credit referral payout list', () => {
  const now = Date.parse('2026-11-04T15:00:00.000Z')

  it('lists each referred credit client and uses a recorded payout status', () => {
    const rows = selectCreditReferralPayouts([
      payoutSource(),
      payoutSource({
        referralId: 'ref-paid',
        referrerName: 'Grace Hopper',
        referredName: 'Katherine Johnson',
        referralStatus: 'submitted',
        commissionId: 'com-paid',
        commissionStatus: 'paid',
        commissionAmountCents: 5000,
        commissionPaidAt: '2026-11-01T16:30:00.000Z',
        payoutStatus: 'paid',
        payoutProcessedAt: '2026-11-01T16:30:00.000Z',
        payoutAmountCents: 5000,
      }),
      payoutSource({
        referralId: 'ref-owed',
        referrerName: 'Ada Lovelace',
        referredName: 'Alan Turing',
        commissionId: 'com-owed',
        commissionStatus: 'available',
        commissionAmountCents: 5000,
        commissionReady: true,
      }),
      payoutSource({
        referralId: 'partner-ref',
        referrerClientId: 'partner-client',
        partnerProfile: true,
        commissionId: 'com-partner',
        commissionStatus: 'available',
        commissionAmountCents: 5000,
      }),
    ])

    assert.deepEqual(rows.map((row) => row.referralId), ['ref-owed', 'ref-1', 'ref-paid'])
    assert.equal(rows[0].status, 'owed')
    assert.equal(rows[0].paid, false)
    assert.equal(rows[0].canMarkPaid, true)
    assert.equal(rows[0].amountCents, 5000)
    assert.equal(rows[0].code, 'ADA23456')
    assert.equal(rows[1].status, 'submitted')
    assert.equal(rows[1].amountCents, null)
    assert.equal(rows[1].canMarkPaid, false)
    assert.equal(rows[2].paid, true)
    assert.equal(rows[2].paidAt, '2026-11-01T16:30:00.000Z')
    assert.equal(creditReferralStatusLabel('owed'), 'Owed')
    assert.equal(creditReferralStatusLabel('applicant_paid'), 'Applicant paid')
  })

  it('does not treat an applicant payment as the referrer being paid', () => {
    const [row] = selectCreditReferralPayouts([
      payoutSource({ referralStatus: 'paid' }),
    ])
    assert.equal(row.status, 'applicant_paid')
    assert.equal(row.paid, false)
    assert.equal(row.amountCents, null)
    assert.equal(row.canMarkPaid, false)
  })

  it('keeps a pending hold unpaid until it is ready, and blocks in-progress payouts', () => {
    const rows = selectCreditReferralPayouts([
      payoutSource({
        referralId: 'held',
        referrerName: 'Held',
        commissionId: 'com-held',
        commissionStatus: 'pending',
        commissionAmountCents: 5000,
        commissionReady: false,
      }),
      payoutSource({
        referralId: 'processing',
        referrerName: 'Processing',
        commissionId: 'com-processing',
        commissionStatus: 'processing',
        commissionAmountCents: 5000,
        payoutStatus: 'processing',
      }),
    ])
    const held = rows.find((row) => row.referralId === 'held')
    const processing = rows.find((row) => row.referralId === 'processing')
    assert.ok(held)
    assert.ok(processing)
    assert.equal(held.status, 'pending')
    assert.equal(held.canMarkPaid, false)
    assert.equal(processing.status, 'processing')
    assert.equal(processing.canMarkPaid, false)
    assert.equal(processing.paid, false)
  })

  it('builds rows from stored referrals and prefers the referred client name', () => {
    const sources = buildCreditReferralPayoutSources({
      profiles: [
        { id: 'profile-1', client_id: 'referrer-1', referral_code: 'CODE2345' },
        { id: 'profile-partner', client_id: null, partner_profile_id: 'partner-1', referral_code: 'PART2345' },
      ],
      referrals: [
        {
          id: 'ref-1',
          referral_profile_id: 'profile-1',
          referred_application_id: 'app-1',
          referred_client_id: 'referred-1',
          referral_status: 'accepted',
        },
        {
          id: 'ref-partner',
          referral_profile_id: 'profile-partner',
          referred_application_id: 'app-2',
          referred_client_id: null,
          referral_status: 'submitted',
        },
      ],
      commissions: [
        {
          id: 'com-1',
          referral_id: 'ref-1',
          amount_cents: 5000,
          status: 'pending',
          paid_at: null,
          payout_id: null,
          available_at: '2026-11-04T14:00:00.000Z',
        },
      ],
      payouts: [],
      clients: [
        { id: 'referrer-1', name: 'Ada Lovelace' },
        { id: 'referred-1', name: 'Grace Hopper' },
      ],
      applications: [{ id: 'app-1', full_name: 'Application Name' }],
      nowMs: now,
    })
    const [row] = selectCreditReferralPayouts(sources)
    assert.equal(sources.length, 1)
    assert.equal(row.referrerName, 'Ada Lovelace')
    assert.equal(row.code, 'CODE2345')
    assert.equal(row.referredName, 'Grace Hopper')
    assert.equal(row.status, 'owed')
    assert.equal(row.canMarkPaid, true)
  })

  it('records mark-paid through the manual payout ledger and keeps it admin-only', () => {
    const route = readFileSync('src/app/api/admin/referrals/[clientId]/route.ts', 'utf8')
    const service = readFileSync('src/lib/referral-service.ts', 'utf8')
    const page = readFileSync('src/app/admin/referrals/page.tsx', 'utf8')
    const nav = readFileSync('src/lib/marketing-pipeline.ts', 'utf8')
    const markPaid = service.slice(
      service.indexOf('export async function markReferralCommissionPaid'),
      service.indexOf('export async function initiateReferralPayout')
    )
    assert.match(route, /requireAdminSession/)
    assert.match(route, /action === 'mark_paid'/)
    assert.match(route, /markReferralCommissionPaid/)
    assert.match(markPaid, /payment_provider: 'manual'/)
    assert.doesNotMatch(markPaid, /getStripe\(/)
    assert.doesNotMatch(markPaid, /transfers\.create/)
    assert.match(page, /Mark paid/)
    assert.match(page, /No one has referred a credit client yet/)
    assert.doesNotMatch(page, /<table/)
    assert.match(nav, /href: '\/admin\/referrals'/)
    assert.match(nav, /label: 'Referrals'/)
    const redirects = readFileSync('next.config.js', 'utf8')
    assert.doesNotMatch(redirects, /source: '\/admin\/referrals'/)
  })
})

describe('referral system wiring', () => {
  it('attaches referrals at intake from the signed cookie, not a client-supplied body field', () => {
    const intake = readFileSync('src/app/api/credit-funding/intake/route.ts', 'utf8')
    const form = readFileSync('src/components/credit-funding/CreditFundingForm.tsx', 'utf8')
    const finalize = readFileSync('src/lib/credit-funding-finalize.ts', 'utf8')
    assert.match(intake, /attachReferralToApplication/)
    assert.doesNotMatch(intake, /body\.ref/)
    assert.match(form, /\/api\/referrals\/track/)
    assert.match(finalize, /ensureReferralProfileIfRepairClient/)
  })

  it('awards commission from the repair invoice paid path with unique payment ids', () => {
    const webhook = readFileSync('src/app/api/stripe/webhook/route.ts', 'utf8')
    const billing = readFileSync('src/lib/billing-service.ts', 'utf8')
    const service = readFileSync('src/lib/referral-service.ts', 'utf8')
    const migration = readFileSync('supabase-migration-038-credit-repair-referrals.sql', 'utf8')
    assert.match(webhook, /awardReferralCommissionForPaidClient/)
    assert.match(webhook, /handleStripePayoutEvent/)
    assert.match(billing, /awardReferralCommissionForPaidClient/)
    assert.match(service, /qualifyingPaymentId/)
    assert.match(service, /getCommissionByPaymentId/)
    assert.match(service, /getActiveCommissionForReferredClient/)
    assert.match(migration, /referral_commissions_payment_unique/)
    assert.match(migration, /idx_referral_commissions_one_per_client/)
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
    assert.doesNotMatch(migration, /CREATE POLICY/)
  })

  it('does not import the referral service from client-bundled billing helpers', () => {
    const billingHelpers = readFileSync('src/lib/credit-repair-billing.ts', 'utf8')
    assert.doesNotMatch(billingHelpers, /referral-service/)
    assert.doesNotMatch(billingHelpers, /smtp-mail/)
  })

  it('keeps client referral APIs privacy-conscious and staff-gated', () => {
    const dash = readFileSync('src/app/api/dashboard/referrals/route.ts', 'utf8')
    const clientPage = readFileSync('src/app/dashboard/referrals/page.tsx', 'utf8')
    const admin = readFileSync('src/app/api/admin/referrals/route.ts', 'utf8')
    const adminClient = readFileSync('src/app/api/admin/referrals/[clientId]/route.ts', 'utf8')
    const service = readFileSync('src/lib/referral-service.ts', 'utf8')
    assert.match(dash, /requireClientSession/)
    assert.match(dash, /getClientReferralDashboard/)
    assert.doesNotMatch(clientPage, /social security/i)
    assert.doesNotMatch(clientPage, /date of birth/i)
    assert.doesNotMatch(clientPage, /credit report/i)
    assert.doesNotMatch(clientPage, /credit_score/i)
    assert.match(admin, /requireAdminSession/)
    assert.match(adminClient, /requireAdminSession/)
    assert.match(service, /maskApplicantName/)
    assert.match(service, /privacy \? maskApplicantName/)
  })

  it('redirects legacy credit URLs onto /credit', () => {
    const config = readFileSync('next.config.js', 'utf8')
    assert.match(config, /source: '\/service'/)
    assert.match(config, /destination: '\/services'/)
    assert.doesNotMatch(config, /source: '\/services'/)
    assert.match(config, /credit-funding-application/)
    assert.match(config, /destination: '\/credit'/)
    const creditPage = readFileSync('src/app/credit/page.tsx', 'utf8')
    assert.doesNotMatch(creditPage, /CreditReadiness/)
    assert.match(creditPage, /CreditFundingForm/)
  })
})
