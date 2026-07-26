import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getNextWorkflowStatus,
  getPreviousWorkflowStatus,
  getWorkflowOrder,
  isInWorkflow,
  resolveWorkflowDisplayStatus,
} from '../credit-funding-types'
import { buildWorkflowSteps } from '../credit-funding-workflow-steps'

describe('getWorkflowOrder', () => {
  it('excludes Documents Pending for everyone', () => {
    assert.equal(getWorkflowOrder(true).includes('documents_pending'), false)
    assert.equal(getWorkflowOrder(false).includes('documents_pending'), false)
  })

  it('includes funding close-out steps only for business owners', () => {
    const business = getWorkflowOrder(true)
    const personal = getWorkflowOrder(false)

    assert.deepEqual(personal, [
      'submitted',
      'under_review',
      'credit_analysis_complete',
    ])
    assert.ok(business.includes('funding_review'))
    assert.ok(business.includes('additional_information_requested'))
    assert.ok(business.includes('approved'))
    assert.ok(business.includes('completed'))
    assert.equal(personal.includes('funding_review'), false)
    assert.equal(personal.includes('approved'), false)
    assert.equal(personal.includes('completed'), false)
  })
})

describe('workflow navigation', () => {
  it('advances personal applicants through the short path', () => {
    assert.equal(getNextWorkflowStatus('submitted', false), 'under_review')
    assert.equal(getNextWorkflowStatus('under_review', false), 'credit_analysis_complete')
    assert.equal(getNextWorkflowStatus('credit_analysis_complete', false), null)
  })

  it('advances business owners into funding steps', () => {
    assert.equal(getNextWorkflowStatus('credit_analysis_complete', true), 'funding_review')
    assert.equal(getNextWorkflowStatus('funding_review', true), 'additional_information_requested')
    assert.equal(getNextWorkflowStatus('approved', true), 'completed')
    assert.equal(getNextWorkflowStatus('completed', true), null)
  })

  it('keeps documents_pending advanceable as a side status', () => {
    assert.equal(isInWorkflow('documents_pending', false), true)
    assert.equal(isInWorkflow('documents_pending', true), true)
    assert.equal(getNextWorkflowStatus('documents_pending', false), 'under_review')
    assert.equal(getPreviousWorkflowStatus('documents_pending', true), 'submitted')
  })

  it('does not treat business-only statuses as in-workflow for personal applicants', () => {
    assert.equal(isInWorkflow('funding_review', false), false)
    assert.equal(isInWorkflow('approved', false), false)
    assert.equal(isInWorkflow('under_review', false), true)
  })
})

describe('buildWorkflowSteps', () => {
  it('renders three steps for personal applicants', () => {
    const steps = buildWorkflowSteps('under_review', [], false)
    assert.deepEqual(
      steps.map((s) => s.label),
      ['Submitted', 'Under Review', 'Credit Analysis Complete']
    )
    assert.equal(steps[0].isComplete, true)
    assert.equal(steps[1].isCurrent, true)
    assert.equal(steps[2].isUpcoming, true)
  })

  it('renders funding steps for business owners', () => {
    const steps = buildWorkflowSteps('funding_review', [], true)
    assert.ok(steps.some((s) => s.status === 'funding_review' && s.isCurrent))
    assert.ok(steps.some((s) => s.status === 'approved' && s.isUpcoming))
    assert.ok(steps.some((s) => s.status === 'completed' && s.isUpcoming))
  })

  it('maps documents_pending onto Submitted in the strip', () => {
    assert.equal(resolveWorkflowDisplayStatus('documents_pending', false), 'submitted')
    const steps = buildWorkflowSteps('documents_pending', [], false)
    const submitted = steps.find((s) => s.status === 'submitted')
    assert.ok(submitted?.isCurrent)
  })

  it('marks all personal steps complete when application is completed', () => {
    const steps = buildWorkflowSteps('completed', [], false)
    assert.equal(steps.every((s) => s.isComplete), true)
    assert.equal(steps.some((s) => s.status === 'completed'), false)
  })

  it('shows Completed as current for business owners', () => {
    const steps = buildWorkflowSteps('completed', [], true)
    const completed = steps.find((s) => s.status === 'completed')
    assert.ok(completed?.isCurrent)
    assert.equal(steps.filter((s) => s.isComplete).length, steps.length - 1)
  })

  it('appends declined/archived without dropping earlier steps', () => {
    const declined = buildWorkflowSteps('declined', [], false)
    assert.equal(declined.at(-1)?.status, 'declined')
    assert.equal(declined.at(-1)?.isCurrent, true)
    assert.equal(declined.slice(0, -1).every((s) => s.isComplete), true)
  })
})
