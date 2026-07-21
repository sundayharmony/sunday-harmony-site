import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, describe, it } from 'node:test'
import {
  parseIntakePayload,
  validateDraftPayload,
  validateIntakePayload,
} from '../credit-funding-validation'
import {
  buildPartialEncryptedApplicationRow,
  buildInvitePrefillFromApplication,
  formatDraftForStaffEditor,
  mergeIntakePayloadWithExistingSecrets,
} from '../credit-funding-sensitive-fields'
import type { CreditFundingApplication } from '../credit-funding-types'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

const originalKey = process.env.CREDIT_FUNDING_ENCRYPTION_KEY

before(() => {
  process.env.CREDIT_FUNDING_ENCRYPTION_KEY = Buffer.from('a'.repeat(32)).toString('base64')
})

after(() => {
  if (originalKey === undefined) delete process.env.CREDIT_FUNDING_ENCRYPTION_KEY
  else process.env.CREDIT_FUNDING_ENCRYPTION_KEY = originalKey
})

function minimalPayload(overrides: Record<string, unknown> = {}) {
  return parseIntakePayload({
    fullName: 'Alex Client',
    email: 'alex@example.com',
    ...overrides,
  })
}

describe('Staff draft applications', () => {
  it('allows partial draft validation with only name and email', () => {
    const payload = minimalPayload()
    assert.equal(validateDraftPayload(payload), null)
    assert.notEqual(validateIntakePayload(payload), null)
  })

  it('rejects draft saves without email or name', () => {
    assert.match(validateDraftPayload(minimalPayload({ fullName: '' })) || '', /name/i)
    assert.match(validateDraftPayload(minimalPayload({ email: 'bad' })) || '', /email/i)
  })

  it('builds partial encrypted rows and preserves existing secrets when blank', () => {
    const first = buildPartialEncryptedApplicationRow(
      minimalPayload({
        phone: '5551234567',
        providerPassword: 'secret-one',
      })
    )
    assert.equal(first.full_name, 'Alex Client')
    assert.equal(first.email, 'alex@example.com')
    assert.equal(first.status, undefined)
    assert.ok(typeof first.provider_password_encrypted === 'string')
    assert.ok((first.provider_password_encrypted as string).length > 0)

    const existing = {
      ...first,
      id: '123e4567-e89b-42d3-a456-426614174000',
      application_id: 'CF-TEST',
      funding_goals: '',
      consent_data: {},
      typed_signature: first.typed_signature,
      signature_date: first.signature_date,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as CreditFundingApplication

    const second = buildPartialEncryptedApplicationRow(
      minimalPayload({ phone: '5559998888', providerPassword: '' }),
      { preserveSecretsFrom: existing }
    )
    assert.equal(second.provider_password_encrypted, first.provider_password_encrypted)
    assert.notEqual(second.phone, first.phone)
  })

  it('merges blank submitted secrets with existing encrypted values', () => {
    const existingRow = buildPartialEncryptedApplicationRow(
      minimalPayload({
        ssn: '123456789',
        dateOfBirth: '1990-01-01',
        phone: '5551112222',
        address: '1 Main',
        city: 'Miami',
        state: 'FL',
        zipCode: '33101',
        selectedCreditProvider: 'IdentityIQ',
        providerUsername: 'user1',
        providerPassword: 'pass1',
        experianEmail: 'a@ex.com',
        experianPassword: 'epass',
        cfpbEmail: 'c@ex.com',
        cfpbPassword: 'cpass',
        typedSignature: 'Alex Client',
        fundingAmount: '10000',
        fundingUse: 'Personal',
        fundingTimeframe: 'Immediately',
        primaryCreditGoalsText: 'Improve score',
        consent: { accurateInfo: true, authorizeReview: true, agreeTerms: true },
      })
    )

    const existing = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      application_id: 'CF-TEST',
      full_name: 'Alex Client',
      email: 'alex@example.com',
      ...existingRow,
      funding_goals: '',
      status: 'invitation_pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as CreditFundingApplication

    const merged = mergeIntakePayloadWithExistingSecrets(
      minimalPayload({
        phone: '5551112222',
        address: '1 Main',
        city: 'Miami',
        state: 'FL',
        zipCode: '33101',
        selectedCreditProvider: 'IdentityIQ',
        providerUsername: '',
        providerPassword: '',
        experianEmail: '',
        experianPassword: '',
        cfpbEmail: '',
        cfpbPassword: '',
        fundingAmount: '10000',
        fundingUse: 'Personal',
        fundingTimeframe: 'Immediately',
        primaryCreditGoalsText: 'Improve score',
        consent: { accurateInfo: true, authorizeReview: true, agreeTerms: true },
        typedSignature: '',
        dateOfBirth: '',
        ssn: '',
      }),
      existing,
      {
        ssnSet: true,
        dateOfBirthSet: true,
        providerUsernameSet: true,
        providerPasswordSet: true,
        experianEmailSet: true,
        experianPasswordSet: true,
        cfpbEmailSet: true,
        cfpbPasswordSet: true,
        typedSignatureSet: true,
      }
    )

    assert.equal(merged.ssn, '123456789')
    assert.equal(merged.providerPassword, 'pass1')
    assert.equal(merged.typedSignature, 'Alex Client')
    assert.equal(validateIntakePayload(merged), null)
  })

  it('wires draft status, APIs, shared finalize, and admin UI', () => {
    const types = source('src/lib/credit-funding-types.ts')
    const crm = source('src/lib/crm-types.ts')
    const migration = source('supabase-migration-027-credit-funding-drafts.sql')
    const finalize = source('src/lib/credit-funding-finalize.ts')
    const intake = source('src/app/api/credit-funding/intake/route.ts')
    const invite = source('src/app/api/credit-funding/invite/route.ts')
    const adminPage = source('src/app/admin/credit-funding/page.tsx')
    const draftRoute = source('src/app/api/admin/credit-funding/drafts/route.ts')
    const draftIdRoute = source('src/app/api/admin/credit-funding/drafts/[id]/route.ts')
    const draftDocs = source('src/app/api/admin/credit-funding/drafts/[id]/documents/route.ts')

    assert.match(types, /'draft'/)
    assert.match(crm, /draft: 'intake_started'/)
    assert.match(migration, /'draft'/)
    assert.match(migration, /created_by_staff_email/)
    assert.match(finalize, /runCreditFundingSubmissionSideEffects/)
    assert.match(intake, /runCreditFundingSubmissionSideEffects/)
    assert.match(intake, /mergeIntakePayloadWithExistingSecrets/)
    assert.match(invite, /hasPrefill/)
    assert.match(invite, /buildInvitePrefillFromApplication/)
    assert.match(draftRoute, /createStaffDraftApplication/)
    assert.match(draftRoute, /requireCreditFundingStaffSession/)
    assert.match(draftRoute, /formatDraftForStaffEditor/)
    assert.match(draftRoute, /rateLimitDurable/)
    assert.match(draftIdRoute, /send-finish-link/)
    assert.match(draftIdRoute, /finalize/)
    assert.match(draftIdRoute, /cancel-finish-link/)
    assert.match(draftIdRoute, /formatDraftForStaffEditor/)
    assert.match(draftIdRoute, /rateLimitDurable\(`cf-draft-save/)
    assert.match(draftIdRoute, /isUuid/)
    assert.doesNotMatch(draftIdRoute, /decryptApplicationSensitiveFields/)
    assert.match(draftIdRoute, /expiresAt: inviteExpiresAt\.toISOString\(\)/)
    assert.doesNotMatch(
      draftIdRoute,
      /return draftJson\(\{\s*success: true,\s*\.\.\.formatApplicationListItemForAdmin\(updated\),\s*inviteUrl:/
    )
    assert.match(draftDocs, /requireCreditFundingStaffSession/)
    assert.match(draftDocs, /isUuid/)
    assert.doesNotMatch(draftDocs, /storage_path: doc/)
    assert.match(adminPage, /StaffDraftEditor/)
    assert.match(adminPage, /New Draft Application/)
  })

  it('keeps staff draft and invite prefill free of plaintext secrets', () => {
    const row = buildPartialEncryptedApplicationRow(
      minimalPayload({
        ssn: '123456789',
        dateOfBirth: '1990-01-02',
        phone: '5551112222',
        address: '1 Main',
        city: 'Miami',
        state: 'FL',
        zipCode: '33101',
        selectedCreditProvider: 'IdentityIQ',
        providerUsername: 'user1',
        providerPassword: 'pass1',
        experianEmail: 'a@ex.com',
        experianPassword: 'epass',
        cfpbEmail: 'c@ex.com',
        cfpbPassword: 'cpass',
        typedSignature: 'Alex Client',
        creditProfile: { monthlyGrossIncome: '5000', annualIncome: '60000' },
        businessProfile: { legalName: 'Acme', ein: '12-3456789' },
      })
    )

    const app = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      application_id: 'CF-TEST',
      full_name: 'Alex Client',
      email: 'alex@example.com',
      ...row,
      funding_goals: '',
      status: 'draft',
      draft_source: 'staff_manual',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as CreditFundingApplication

    const staffDraft = formatDraftForStaffEditor(app)
    assert.equal(staffDraft.ssn, '')
    assert.equal(staffDraft.provider_password, '')
    assert.equal(staffDraft.typed_signature, '')
    assert.equal(staffDraft.ssnSet, true)
    assert.equal(staffDraft.providerPasswordSet, true)

    const prefill = buildInvitePrefillFromApplication(app)
    assert.equal(prefill.ssn, '')
    assert.equal(prefill.dateOfBirth, '')
    assert.equal(prefill.providerPassword, '')
    assert.equal(prefill.providerUsername, '')
    assert.equal(prefill.experianPassword, '')
    assert.equal(prefill.cfpbPassword, '')
    assert.equal(prefill.typedSignature, '')
    assert.equal(prefill.ssnSet, true)
    assert.equal(prefill.dateOfBirthSet, true)
    assert.equal((prefill.creditProfile as { monthlyGrossIncome?: string }).monthlyGrossIncome, undefined)
    assert.equal((prefill.businessProfile as { ein?: string }).ein, undefined)
    assert.equal(prefill.einSet, true)
  })
})
