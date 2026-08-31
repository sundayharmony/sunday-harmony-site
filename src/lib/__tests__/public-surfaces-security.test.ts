import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, describe, it } from 'node:test'
import {
  createApplicationInviteToken,
  inviteTokenMatchesStoredExpiry,
  maskInviteEmail,
  verifyApplicationInviteToken,
} from '../credit-funding-invite'
import { getCaseStudyPdfRoute } from '../client-case-studies-storage'
import { hasHoneypotValue } from '../honeypot'

const originalSigningSecret = process.env.CREDIT_FUNDING_SIGNING_SECRET

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

before(() => {
  process.env.CREDIT_FUNDING_SIGNING_SECRET = 'area-11-test-signing-secret'
})

after(() => {
  if (originalSigningSecret === undefined) {
    delete process.env.CREDIT_FUNDING_SIGNING_SECRET
  } else {
    process.env.CREDIT_FUNDING_SIGNING_SECRET = originalSigningSecret
  }
})

describe('Area 11 public surface hardening', () => {
  it('invalidates invitation tokens when the stored expiry changes', () => {
    const applicationId = '123e4567-e89b-42d3-a456-426614174000'
    const expiresAtMs = Date.parse('2026-07-16T12:00:00.000Z')
    const token = createApplicationInviteToken(applicationId, expiresAtMs)
    const verified = verifyApplicationInviteToken(token)

    assert.deepEqual(verified, { applicationId, expiresAtMs })
    assert.equal(inviteTokenMatchesStoredExpiry(verified!, '2026-07-16T12:00:00.000Z'), true)
    assert.equal(inviteTokenMatchesStoredExpiry(verified!, '2026-07-17T12:00:00.000Z'), false)
  })

  it('masks invite email and avoids public invite PII prefill keys', () => {
    assert.equal(maskInviteEmail('alex@example.com'), 'a**x@example.com')

    const inviteRoute = source('src/app/api/credit-funding/invite/route.ts')
    assert.match(inviteRoute, /maskedEmail/)
    assert.doesNotMatch(inviteRoute, /fullName:/)
    assert.doesNotMatch(inviteRoute, /phone,/)
  })

  it('rejects shared honeypot fields for JSON and FormData submissions', () => {
    assert.equal(hasHoneypotValue({ companyWebsite: '' }), false)
    assert.equal(hasHoneypotValue({ companyWebsite: 'https://spam.example' }), true)

    const formData = new FormData()
    formData.set('website', 'bot-value')
    assert.equal(hasHoneypotValue(formData), true)
  })

  it('serves case studies through a private app route and migration', () => {
    const id = '123e4567-e89b-42d3-a456-426614174000'
    assert.equal(getCaseStudyPdfRoute(id), `/api/case-studies/${id}/pdf`)

    const publicApi = source('src/app/api/case-studies/route.ts')
    const publicPage = source('src/app/case-studies/page.tsx')
    const pdfRoute = source('src/app/api/case-studies/[id]/pdf/route.ts')
    const storage = source('src/lib/client-case-studies-storage.ts')
    const migration = source('supabase/migrations/20260715200719_private_case_study_delivery.sql')

    assert.match(publicApi, /getCaseStudyPdfRoute/)
    assert.match(publicPage, /getCaseStudyPdfRoute/)
    assert.match(pdfRoute, /study\?\.published/)
    assert.match(storage, /createSignedUrl/)
    assert.match(migration, /public = false/)
    assert.match(migration, /DROP POLICY IF EXISTS "client_case_studies_select_public"/)
    assert.match(migration, /\/api\/case-studies\//)
  })

  it('rate-limits contact submissions after validation, not before', () => {
    const contact = source('src/app/api/contact/route.ts')
    const honeypot = contact.indexOf('hasHoneypotValue')
    const required = contact.indexOf('First name is required')
    const rateLimit = contact.indexOf('rateLimitDurable')
    assert.ok(honeypot >= 0 && required > honeypot, 'honeypot should run before field validation')
    assert.ok(rateLimit > required, 'rate limit should run after field validation')
  })
})
