import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import {
  decryptField,
  decryptFieldOrLegacy,
  encryptField,
  isEncryptedField,
} from '../field-encryption'
import {
  buildEncryptedInvitationRow,
  decryptFreeTextForView,
  encryptFreeTextForDb,
} from '../credit-funding-sensitive-fields'
import {
  formatApplicationForAdmin,
  formatApplicationListItemForAdmin,
  revealApplicationSensitiveField,
} from '../credit-funding-admin'
import type { CreditFundingApplication } from '../credit-funding-types'

const originalKey = process.env.CREDIT_FUNDING_ENCRYPTION_KEY
const testKey = Buffer.alloc(32, 7).toString('base64')

function legacyEncrypt(plaintext: string): string {
  const key = Buffer.from(testKey, 'base64')
  const iv = Buffer.alloc(12, 1)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

function sampleApplication(): CreditFundingApplication {
  return {
    id: 'app-1',
    application_id: 'CF-TEST',
    full_name: 'Jane Applicant',
    email: 'jane@example.test',
    phone: encryptField('555-111-2222'),
    address: encryptField('123 Main St'),
    city: encryptField('Miami'),
    state: encryptField('FL'),
    zip_code: encryptField('33101'),
    date_of_birth_encrypted: encryptField('1990-01-01'),
    ssn_encrypted: encryptField('123456789'),
    credit_profile: {
      creditScore: '720',
      monthlyGrossIncome: encryptField('9000'),
      annualIncome: encryptField('108000'),
    },
    selected_credit_provider: 'IdentityIQ',
    provider_username_encrypted: encryptField('jane-login'),
    provider_password_encrypted: encryptField('ProviderPass1'),
    experian_email_encrypted: encryptField('jane-experian@example.test'),
    experian_password_encrypted: encryptField('ExperianPass1'),
    cfpb_email_encrypted: encryptField('jane-cfpb@example.test'),
    cfpb_password_encrypted: encryptField('CfpbPass1'),
    credit_goals: ['Credit Repair'],
    funding_goals: 'Funding goal',
    primary_credit_goals_text: encryptField('Remove inaccurate trade lines'),
    funding_amount: '$25,000',
    funding_use: 'Working Capital',
    owns_business: true,
    business_name: 'Jane LLC',
    funding_timeframe: '30 Days',
    goals_notes: encryptField('Sensitive goal notes'),
    consent_data: {
      accurateInfo: true,
      authorizeReview: true,
      agreeTerms: true,
    },
    typed_signature: encryptField('Jane Applicant'),
    signature_date: '2026-07-15',
    status: 'submitted',
    internal_notes: encryptField('Internal sensitive note'),
    client_notes: encryptField('Client sensitive note'),
    next_steps: encryptField('Next sensitive step'),
    service_type: 'credit_and_funding',
    invite_personal_message: encryptField('Welcome message'),
    business_profile: {
      legalName: 'Jane LLC',
      einEncrypted: encryptField('987654321'),
      addressEncrypted: encryptField('456 Business Ave'),
      phoneEncrypted: encryptField('555-333-4444'),
      emailEncrypted: encryptField('business@example.test'),
    } as CreditFundingApplication['business_profile'],
    funding_scores: {},
    created_at: '2026-07-15T00:00:00.000Z',
    updated_at: '2026-07-15T00:00:00.000Z',
  }
}

before(() => {
  process.env.CREDIT_FUNDING_ENCRYPTION_KEY = testKey
})

after(() => {
  if (originalKey === undefined) {
    delete process.env.CREDIT_FUNDING_ENCRYPTION_KEY
  } else {
    process.env.CREDIT_FUNDING_ENCRYPTION_KEY = originalKey
  }
})

describe('credit-funding encryption hardening', () => {
  it('writes versioned ciphertext and still reads legacy ciphertext', () => {
    const encrypted = encryptField('secret-value')
    assert.match(encrypted, /^enc:v1:/)
    assert.equal(decryptField(encrypted), 'secret-value')
    assert.equal(isEncryptedField(encrypted), true)

    const legacy = legacyEncrypt('legacy-secret')
    assert.doesNotMatch(legacy, /^enc:v1:/)
    assert.equal(decryptField(legacy), 'legacy-secret')
    assert.equal(decryptFieldOrLegacy('plain text'), 'plain text')
  })

  it('encrypts free text and pending invitation contact fields', () => {
    const encryptedNote = encryptFreeTextForDb('  sensitive note  ')
    assert.match(encryptedNote || '', /^enc:v1:/)
    assert.equal(decryptFreeTextForView(encryptedNote), 'sensitive note')

    const invitation = buildEncryptedInvitationRow({
      fullName: 'Jane Applicant',
      email: 'JANE@EXAMPLE.TEST',
      phone: '555-111-2222',
      inviteExpiresAt: new Date('2026-07-16T00:00:00.000Z'),
      personalMessage: 'Welcome Jane',
    })

    assert.equal(invitation.email, 'jane@example.test')
    assert.match(String(invitation.phone), /^enc:v1:/)
    assert.match(String(invitation.address), /^enc:v1:/)
    assert.match(String(invitation.typed_signature), /^enc:v1:/)
    assert.match(String(invitation.invite_personal_message), /^enc:v1:/)
  })

  it('redacts admin default details but allows explicit reveal helpers', () => {
    const app = sampleApplication()
    const admin = formatApplicationForAdmin(app) as Record<string, any>

    assert.equal(admin.phone, '555-111-2222')
    assert.equal(admin.internal_notes, 'Internal sensitive note')
    assert.equal(admin.ssn, '••••••••')
    assert.equal(admin.provider_password, '••••••••')
    assert.equal(admin.credit_profile.monthlyGrossIncome, '••••••••')
    assert.equal(admin.business_profile.ein, '••••••••')

    assert.equal(revealApplicationSensitiveField(app, 'ssn'), '123456789')
    assert.equal(revealApplicationSensitiveField(app, 'provider_password'), 'ProviderPass1')
    assert.equal(revealApplicationSensitiveField(app, 'monthly_gross_income'), '9000')
    assert.equal(revealApplicationSensitiveField(app, 'business_ein'), '987654321')
  })

  it('formats admin list items without secret fields', () => {
    const listItem = formatApplicationListItemForAdmin(sampleApplication()) as Record<string, unknown>
    assert.equal(listItem.phone, '555-111-2222')
    assert.equal('ssn' in listItem, false)
    assert.equal('provider_password' in listItem, false)
    assert.equal('date_of_birth' in listItem, false)
  })
})
