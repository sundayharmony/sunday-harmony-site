import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { destinationAfterLogin } from '../login-redirect'
import {
  isReferralProfileAttributable,
  shouldSkipPartnerCommission,
  toPartnerReferralProgress,
} from '../partner-progress'
import { parsePartnerSignup } from '../partner-signup'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('partner signup validation', () => {
  const valid = {
    fullName: 'Alex Rivera',
    email: 'alex@broker.example',
    password: 'Harbor1a',
    phone: '215-555-0100',
    companyName: 'Rivera Lending',
    serviceArea: 'Philadelphia',
    yearsInField: '8',
    profession: 'mortgage',
  }

  it('accepts a complete partner application', () => {
    const parsed = parsePartnerSignup(valid)
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.value.email, 'alex@broker.example')
    assert.equal(parsed.value.yearsInField, 8)
    assert.equal(parsed.value.profession, 'mortgage')
  })

  it('rejects a weak password, unknown profession, and duplicate-looking empty company', () => {
    assert.equal(parsePartnerSignup({ ...valid, password: 'short' }).ok, false)
    assert.equal(parsePartnerSignup({ ...valid, profession: 'lawyer' }).ok, false)
    assert.equal(parsePartnerSignup({ ...valid, companyName: ' ' }).ok, false)
    assert.equal(parsePartnerSignup({ ...valid, yearsInField: '90' }).ok, false)
  })
})

describe('partner referral progress', () => {
  it('keeps inactive codes from attributing and skips partner commissions', () => {
    assert.equal(isReferralProfileAttributable('active'), true)
    assert.equal(isReferralProfileAttributable('disabled'), false)
    assert.equal(isReferralProfileAttributable(null), false)
    assert.equal(shouldSkipPartnerCommission({ client_id: null, partner_profile_id: 'p1' }), true)
    assert.equal(shouldSkipPartnerCommission({ client_id: 'c1', partner_profile_id: null }), false)

    const service = source('src/lib/referral-service.ts')
    assert.match(service, /isReferralProfileAttributable/)
    assert.match(service, /shouldSkipPartnerCommission/)
  })

  it('exposes only a masked name, stage, and dispute round', () => {
    const row = toPartnerReferralProgress({
      id: 'ref-1',
      date: '2026-10-01T00:00:00.000Z',
      fullName: 'Jane Doe',
      status: 'under_review',
      updatedAt: '2026-10-02T00:00:00.000Z',
      disputeRound: 2,
    })
    assert.equal(row.applicant, 'Jane D.')
    assert.equal(row.stage, 'Under review')
    assert.equal(row.disputeRound, 2)
    assert.equal(row.bucket, 'in_progress')
    const keys = Object.keys(row).sort()
    assert.deepEqual(keys, ['applicant', 'bucket', 'date', 'disputeRound', 'id', 'stage', 'updatedAt'])
    assert.equal(JSON.stringify(row).includes('Doe'), false)
    assert.equal(JSON.stringify(row).includes('@'), false)
  })
})

describe('partner surfaces', () => {
  it('sends partners to their dashboard and keeps signup off the client portal', () => {
    assert.equal(destinationAfterLogin({ role: 'partner' }), '/partner')
    const middleware = source('src/middleware.ts')
    assert.match(middleware, /role !== 'partner'/)
    assert.match(source('src/app/login/page.tsx'), /\/partners\/signup/)
    assert.match(source('src/app/credit/page.tsx'), /Sign up as a partner/)
    assert.match(source('src/app/funding/page.tsx'), /Sign up as a partner/)
    assert.match(source('src/app/api/partners/signup/route.ts'), /rateLimitDurable/)
    assert.match(source('src/app/api/admin/partners/route.ts'), /requireAdminSession/)
    assert.match(source('src/app/api/admin/partners/route.ts'), /getAdminPartnerDetail/)
    assert.match(source('src/app/admin/partners/page.tsx'), /Open /)
    assert.match(source('src/app/api/partner/route.ts'), /requirePartnerSession/)
    assert.doesNotMatch(source('src/app/partner/page.tsx'), /\bssn\b|social security|credit_score|date of birth/i)
  })
})
