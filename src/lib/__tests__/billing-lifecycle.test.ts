import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  activateBillingStatusForTier,
  contractedMonthlyPriceForTier,
} from '../billing-service'

describe('billing lifecycle helpers', () => {
  it('uses catalog prices for contracted monthly totals', () => {
    assert.equal(contractedMonthlyPriceForTier('free'), 0)
    assert.equal(contractedMonthlyPriceForTier('spark'), 500)
    assert.equal(contractedMonthlyPriceForTier('growth'), 1800)
  })

  it('activates billing without forcing paid status on paid tiers', () => {
    assert.equal(activateBillingStatusForTier('free', 'not_started'), 'paid')
    assert.equal(activateBillingStatusForTier('spark', 'paid'), 'paid')
    assert.equal(activateBillingStatusForTier('spark', 'trial'), 'not_started')
    assert.equal(activateBillingStatusForTier('spark', 'not_started'), 'not_started')
  })
})
