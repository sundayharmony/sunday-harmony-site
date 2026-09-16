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
  publicCommissionLabel,
  referralAttributionDays,
  referralCommissionCents,
  safeReferralLandingPath,
  shouldCreateCommission,
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

  it('builds the public credit-funding referral path', () => {
    assert.equal(buildReferralPath('ABC12345'), '/credit-funding?ref=ABC12345')
    assert.equal(referralCommissionCents(), 5000)
    assert.equal(referralAttributionDays(), 60)
    assert.equal(formatCommissionCents(5000), '$50.00')
    assert.equal(publicCommissionLabel('available', 5000), '$50.00')
    assert.equal(publicCommissionLabel('not_eligible', 0), '—')
    assert.equal(publicCommissionLabel('cancelled', 5000), '—')
  })

  it('strips ref and blocks open redirects on landing paths', () => {
    assert.equal(safeReferralLandingPath('/credit-funding?ref=ABC12345&invite=tok'), '/credit-funding?invite=tok')
    assert.equal(safeReferralLandingPath('https://evil.example/credit-funding'), '/credit-funding')
    assert.equal(safeReferralLandingPath('//evil.example'), '/credit-funding')
    assert.equal(safeReferralLandingPath('/dashboard'), '/credit-funding')
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

  it('redirects the spec URL onto the existing credit-funding application', () => {
    const config = readFileSync('next.config.js', 'utf8')
    assert.match(config, /credit-funding-application/)
    assert.match(config, /\/credit-funding/)
  })
})
