import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { toBillingStatus } from '../stripe-billing-status'

describe('toBillingStatus', () => {
  it('maps Stripe subscription statuses to app billing status', () => {
    assert.equal(toBillingStatus('trialing'), 'trial')
    assert.equal(toBillingStatus('active'), 'paid')
    assert.equal(toBillingStatus('past_due'), 'past_due')
    assert.equal(toBillingStatus('unpaid'), 'unpaid')
    assert.equal(toBillingStatus('incomplete'), 'unpaid')
    assert.equal(toBillingStatus('canceled'), 'not_started')
  })
})
