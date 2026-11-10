import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { deriveIntakeClassification } from '../credit-funding-classify'
import { buildIntakePdfModel } from '../credit-funding-intake-pdf'
import {
  buildEncryptedApplicationRow,
  buildPartialEncryptedApplicationRow,
  decryptCreditProfileForAdmin,
  encryptCreditProfileForDb,
} from '../credit-funding-sensitive-fields'
import type { CreditFundingApplication, CreditProfile } from '../credit-funding-types'
import { decryptField } from '../field-encryption'
import { buildFundingAppSubmission } from '../fundingapp'
import { fundingAppFromProfile, parseFundingAppInput } from '../fundingapp-fields'

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Ada',
    lastName: 'Client',
    email: 'Ada@Example.com',
    phone: '(555) 010-1234',
    fundingAmount: '$25,000 – $50,000',
    whyFunding: 'Working capital',
    creditScore: '640',
    llcCreated: 'March 2020',
    businessRevenue: '$8,000 a month',
    personalAccounts: '4 open, 2 closed',
    derogatoryAccounts: 'One collection from 2024',
    monitoringUsername: 'ada-login',
    monitoringPassword: 'SecretPass!',
    experianSecurityAnswer: 'Blue Harbor',
    experianPin: '4321',
    authorizeExperian: true,
    ...overrides,
  }
}

describe('funding application intake', () => {
  it('classifies a business applicant as a credit and funding client', () => {
    const parsed = parseFundingAppInput(validBody())
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.value.email, 'ada@example.com')
    const submission = buildFundingAppSubmission(parsed.value)
    const classification = deriveIntakeClassification(
      submission.payload.creditGoals,
      submission.payload.fundingUse
    )
    assert.equal(classification.serviceType, 'credit_and_funding')
    assert.equal(classification.leadType, 'credit_repair_funding')
    assert.equal(submission.draftSource, 'fundingapp')
    assert.equal(submission.payload.ownsBusiness, true)
    assert.equal(submission.payload.fundingUse, 'Business')
    assert.match(submission.fundingGoals, /Working capital/)
    assert.equal(fundingAppFromProfile(submission.payload.creditProfile)?.llcCreated, 'March 2020')
    assert.equal(fundingAppFromProfile({ creditScore: '700' }), null)
  })

  it('keeps someone without an LLC on the credit and funding path', () => {
    const parsed = parseFundingAppInput(validBody({ llcCreated: 'N/A' }))
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    const submission = buildFundingAppSubmission(parsed.value)
    assert.equal(submission.payload.ownsBusiness, false)
    assert.equal(submission.payload.fundingUse, 'Personal')
    assert.equal(
      deriveIntakeClassification(submission.payload.creditGoals, submission.payload.fundingUse).serviceType,
      'credit_and_funding'
    )
  })

  it('rejects a short form that is missing the new answers or a 4-digit PIN', () => {
    assert.equal(parseFundingAppInput(validBody({ whyFunding: 'A loan' })).ok, false)
    assert.equal(parseFundingAppInput(validBody({ experianPin: '12' })).ok, false)
    assert.equal(parseFundingAppInput(validBody({ experianPin: '12345' })).ok, false)
    assert.equal(parseFundingAppInput(validBody({ authorizeExperian: false })).ok, false)
    assert.equal(parseFundingAppInput(validBody({ derogatoryAccounts: '' })).ok, false)
  })

  it('encrypts the Experian login and the funding-only answers', () => {
    const parsed = parseFundingAppInput(validBody())
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    const submission = buildFundingAppSubmission(parsed.value)
    const row = buildEncryptedApplicationRow(submission.payload)
    const storedRow = row as typeof row & Record<string, string>
    assert.notEqual(row.experian_password_encrypted, 'SecretPass!')
    assert.equal(decryptField(row.experian_password_encrypted), 'SecretPass!')
    assert.equal(decryptField(storedRow.experian_pin_encrypted), '4321')
    assert.equal(decryptField(row.provider_username_encrypted), 'ada-login')
    assert.equal(decryptField(storedRow.experian_security_answer_encrypted), 'Blue Harbor')

    const stored = encryptCreditProfileForDb(submission.payload.creditProfile)
    assert.notEqual(stored.fundingApp?.derogatoryAccounts, 'One collection from 2024')
    const viewed = decryptCreditProfileForAdmin(stored)
    assert.equal(viewed.fundingApp?.businessRevenue, '$8,000 a month')
    assert.equal(viewed.creditScore, '640')
  })

  it('keeps funding-only answers when a staff edit rebuilds the credit profile', () => {
    const parsed = parseFundingAppInput(validBody())
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    const submission = buildFundingAppSubmission(parsed.value)
    const stored = encryptCreditProfileForDb(submission.payload.creditProfile)
    const partial = buildPartialEncryptedApplicationRow(
      { ...submission.payload, creditProfile: { creditScore: '680' } },
      { preserveSecretsFrom: { credit_profile: stored } as CreditFundingApplication }
    )
    const viewed = decryptCreditProfileForAdmin(partial.credit_profile as CreditProfile)
    assert.equal(viewed.creditScore, '680')
    assert.equal(viewed.fundingApp?.whyFunding, 'Working capital')
    assert.equal(viewed.fundingApp?.personalAccounts, '4 open, 2 closed')
  })

  it('adds the extra answers to the intake packet only for this form', () => {
    const parsed = parseFundingAppInput(validBody())
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    const submission = buildFundingAppSubmission(parsed.value)
    const viewed = decryptCreditProfileForAdmin(encryptCreditProfileForDb(submission.payload.creditProfile))
    const fundingPacket = buildIntakePdfModel({
      full_name: 'Ada Client',
      application_id: 'CF-1',
      credit_profile: viewed,
      experian_password: 'SecretPass!',
      credit_goals: submission.payload.creditGoals,
      consent_data: {},
    })
    assert.match(fundingPacket.plainText, /March 2020/)
    assert.match(fundingPacket.plainText, /One collection from 2024/)
    assert.doesNotMatch(fundingPacket.plainText, /SecretPass!/)
    assert.equal(
      fundingPacket.sections.some((section) => section.title === 'Funding application'),
      true
    )

    const creditPacket = buildIntakePdfModel({
      full_name: 'Ada Client',
      application_id: 'CF-2',
      credit_profile: { creditScore: '700' },
      credit_goals: ['Credit Repair'],
      consent_data: {},
    })
    assert.equal(
      creditPacket.sections.some((section) => section.title === 'Funding application'),
      false
    )
  })

  it('keeps the new questions off the existing credit intake', () => {
    const creditForm = readFileSync('src/components/credit-funding/CreditFundingForm.tsx', 'utf8')
    const fundingForm = readFileSync('src/components/funding/FundingAppForm.tsx', 'utf8')
    const route = readFileSync('src/app/api/fundingapp/route.ts', 'utf8')
    assert.equal(creditForm.includes('When was your LLC Created'), false)
    assert.equal(creditForm.includes('Experian Four Digit Pin'), false)
    assert.equal(fundingForm.includes('When was your LLC Created'), true)
    assert.equal(fundingForm.includes('My Fico'), true)
    assert.match(route, /draftSource: submission\.draftSource/)
    assert.equal(route.includes('console.log'), false)
  })
})
