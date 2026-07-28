import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mapApplicationStatusToCfClientStatus } from '../crm-types'
import {
  deriveIntakeClassification,
  isSeekingFunding,
  needsFundingWorkflow,
} from '../credit-funding-classify'
import {
  getNextWorkflowStatus,
  getPreviousWorkflowStatus,
  getWorkflowOrder,
  isInWorkflow,
  resolveWorkflowDisplayStatus,
} from '../credit-funding-types'
import { buildWorkflowSteps } from '../credit-funding-workflow-steps'
import { validateIntakePayload, type IntakeFormPayload } from '../credit-funding-validation'

describe('mapApplicationStatusToCfClientStatus', () => {
  it('maps terminals and approval correctly', () => {
    assert.equal(mapApplicationStatusToCfClientStatus('declined'), 'declined')
    assert.equal(mapApplicationStatusToCfClientStatus('archived'), 'archived')
    assert.equal(mapApplicationStatusToCfClientStatus('approved'), 'active_client')
    assert.equal(mapApplicationStatusToCfClientStatus('completed'), 'completed')
  })

  it('maps workflow and side statuses', () => {
    assert.equal(mapApplicationStatusToCfClientStatus('submitted'), 'intake_completed')
    assert.equal(mapApplicationStatusToCfClientStatus('funding_review'), 'funding_analysis')
    assert.equal(mapApplicationStatusToCfClientStatus('additional_information_requested'), 'documents_pending')
    assert.equal(mapApplicationStatusToCfClientStatus('documents_pending'), 'documents_pending')
  })
})

describe('deriveIntakeClassification', () => {
  it('classifies repair-only without funding use', () => {
    const c = deriveIntakeClassification(['Credit Repair'], '')
    assert.equal(c.seekingFunding, false)
    assert.equal(c.serviceType, 'credit_repair')
    assert.equal(c.leadType, 'credit_repair_lead')
  })

  it('classifies personal funding', () => {
    const c = deriveIntakeClassification(['Personal Funding'], 'Personal')
    assert.equal(c.seekingFunding, true)
    assert.equal(c.serviceType, 'personal_funding')
    assert.equal(c.leadType, 'personal_funding_lead')
  })

  it('classifies business funding', () => {
    const c = deriveIntakeClassification([], 'Business')
    assert.equal(c.seekingFunding, true)
    assert.equal(c.serviceType, 'business_funding')
    assert.equal(c.leadType, 'business_funding_lead')
  })

  it('classifies repair + funding', () => {
    const c = deriveIntakeClassification(['Credit Repair', 'Business Funding'], 'Both')
    assert.equal(c.seekingFunding, true)
    assert.equal(c.serviceType, 'credit_and_funding')
    assert.equal(c.leadType, 'credit_repair_funding')
  })

  it('treats funding use alone as seeking funding', () => {
    assert.equal(isSeekingFunding([], 'Personal'), true)
    assert.equal(needsFundingWorkflow(['Credit Repair'], ''), false)
    assert.equal(needsFundingWorkflow(['Personal Funding'], ''), true)
  })
})

describe('getWorkflowOrder', () => {
  it('excludes side statuses for everyone', () => {
    assert.equal(getWorkflowOrder(true).includes('documents_pending'), false)
    assert.equal(getWorkflowOrder(true).includes('additional_information_requested'), false)
    assert.equal(getWorkflowOrder(false).includes('documents_pending'), false)
  })

  it('includes funding steps only when seeking funding', () => {
    const funding = getWorkflowOrder(true)
    const repair = getWorkflowOrder(false)

    assert.deepEqual(repair, [
      'submitted',
      'under_review',
      'credit_analysis_complete',
      'completed',
    ])
    assert.ok(funding.includes('funding_review'))
    assert.ok(funding.includes('approved'))
    assert.ok(funding.includes('completed'))
    assert.equal(repair.includes('funding_review'), false)
    assert.equal(repair.includes('approved'), false)
  })
})

describe('workflow navigation', () => {
  it('advances repair-only through completed', () => {
    assert.equal(getNextWorkflowStatus('submitted', false), 'under_review')
    assert.equal(getNextWorkflowStatus('under_review', false), 'credit_analysis_complete')
    assert.equal(getNextWorkflowStatus('credit_analysis_complete', false), 'completed')
    assert.equal(getNextWorkflowStatus('completed', false), null)
  })

  it('advances funding path funding_review to approved', () => {
    assert.equal(getNextWorkflowStatus('credit_analysis_complete', true), 'funding_review')
    assert.equal(getNextWorkflowStatus('funding_review', true), 'approved')
    assert.equal(getNextWorkflowStatus('approved', true), 'completed')
  })

  it('treats additional_information_requested as a side status', () => {
    assert.equal(isInWorkflow('additional_information_requested', false), true)
    assert.equal(isInWorkflow('additional_information_requested', true), true)
    assert.equal(getNextWorkflowStatus('additional_information_requested', true), 'funding_review')
    assert.equal(getNextWorkflowStatus('additional_information_requested', false), 'under_review')
    assert.equal(getPreviousWorkflowStatus('documents_pending', true), 'submitted')
  })

  it('does not treat funding-only statuses as in-workflow for repair-only', () => {
    assert.equal(isInWorkflow('funding_review', false), false)
    assert.equal(isInWorkflow('approved', false), false)
    assert.equal(isInWorkflow('under_review', false), true)
  })
})

describe('buildWorkflowSteps', () => {
  it('renders four steps for repair-only including completed', () => {
    const steps = buildWorkflowSteps('under_review', [], false)
    assert.deepEqual(
      steps.map((s) => s.label),
      ['Submitted', 'Under Review', 'Credit Analysis Complete', 'Completed']
    )
    assert.equal(steps[1].isCurrent, true)
  })

  it('renders funding steps when seeking funding', () => {
    const steps = buildWorkflowSteps('funding_review', [], true)
    assert.ok(steps.some((s) => s.status === 'funding_review' && s.isCurrent))
    assert.ok(steps.some((s) => s.status === 'approved' && s.isUpcoming))
    assert.ok(steps.some((s) => s.status === 'completed' && s.isUpcoming))
    assert.equal(steps.some((s) => s.status === 'additional_information_requested'), false)
  })

  it('maps documents_pending onto Submitted in the strip', () => {
    assert.equal(resolveWorkflowDisplayStatus('documents_pending', false), 'submitted')
    const steps = buildWorkflowSteps('documents_pending', [], false)
    const submitted = steps.find((s) => s.status === 'submitted')
    assert.ok(submitted?.isCurrent)
  })

  it('shows Completed as current for funding and repair paths', () => {
    const funding = buildWorkflowSteps('completed', [], true)
    assert.ok(funding.find((s) => s.status === 'completed')?.isCurrent)

    const repair = buildWorkflowSteps('completed', [], false)
    assert.ok(repair.find((s) => s.status === 'completed')?.isCurrent)
  })

  it('appends declined/archived without dropping earlier steps', () => {
    const declined = buildWorkflowSteps('declined', [], false)
    assert.equal(declined.at(-1)?.status, 'declined')
    assert.equal(declined.at(-1)?.isCurrent, true)
    assert.equal(declined.slice(0, -1).every((s) => s.isComplete), true)
  })
})

function basePayload(overrides: Partial<IntakeFormPayload> = {}): IntakeFormPayload {
  return {
    fullName: 'Jane Doe',
    dateOfBirth: '1990-01-01',
    ssn: '123456789',
    email: 'jane@example.com',
    phone: '5551234567',
    address: '1 Main St',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    creditProfile: {},
    selectedCreditProvider: 'IdentityIQ',
    providerUsername: 'jane',
    providerPassword: 'secret1',
    experianEmail: 'jane@example.com',
    experianPassword: 'secret1',
    cfpbEmail: 'jane@example.com',
    cfpbPassword: 'secret1',
    primaryCreditGoalsText: '',
    creditGoals: ['Credit Repair'],
    fundingAmount: '',
    fundingUse: '',
    ownsBusiness: false,
    businessName: '',
    fundingTimeframe: '',
    goalsNotes: '',
    businessProfile: {},
    consent: { accurateInfo: true, authorizeReview: true, agreeTerms: true },
    typedSignature: 'Jane Doe',
    signatureDate: '2026-07-28',
    ...overrides,
  }
}

describe('validateIntakePayload funding optional', () => {
  it('allows repair-only without funding amount/use', () => {
    assert.equal(validateIntakePayload(basePayload()), null)
  })

  it('requires funding fields when seeking funding', () => {
    const err = validateIntakePayload(
      basePayload({ creditGoals: ['Personal Funding'], fundingUse: '', fundingAmount: '' })
    )
    assert.ok(err)
    assert.match(err!, /funding amount/i)
  })

  it('requires valid funding use enum when seeking', () => {
    const err = validateIntakePayload(
      basePayload({
        creditGoals: ['Personal Funding'],
        fundingAmount: '$10,000',
        fundingUse: 'Personal',
        fundingTimeframe: '30 Days',
      })
    )
    assert.equal(err, null)
  })
})
