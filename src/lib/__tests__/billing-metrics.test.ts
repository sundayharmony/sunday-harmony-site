import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeBillingMetrics } from '../billing-metrics'

describe('billing-metrics', () => {
  it('computes contracted and stripe MRR', () => {
    const clients = [
      {
        status: 'active',
        is_potential: false,
        monthly_price: 500,
        billing_status: 'paid',
        stripe_subscription_id: 'sub_1',
      },
      {
        status: 'active',
        is_potential: true,
        monthly_price: 0,
        billing_status: 'not_started',
      },
      {
        status: 'active',
        is_potential: false,
        monthly_price: 1800,
        billing_status: 'past_due',
        stripe_subscription_id: 'sub_2',
      },
    ]

    const m = computeBillingMetrics(clients)
    assert.equal(m.contractedMrr, 2300)
    assert.equal(m.stripeMrr, 500)
    assert.equal(m.atRiskCount, 1)
    assert.equal(m.potentialCount, 1)
  })
})
