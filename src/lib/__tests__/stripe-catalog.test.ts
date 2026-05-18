import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { getTierFromPriceId, monthlyPriceFromStripeUnitAmount } from '../stripe-catalog'

describe('stripe-catalog', () => {
  const original = process.env

  beforeEach(() => {
    process.env = {
      ...original,
      STRIPE_PRICE_SPARK: 'price_spark_test',
      STRIPE_PRICE_GROWTH: 'price_growth_test',
    }
  })

  afterEach(() => {
    process.env = original
  })

  it('maps price id to tier', () => {
    assert.equal(getTierFromPriceId('price_spark_test'), 'spark')
    assert.equal(getTierFromPriceId('unknown'), undefined)
  })

  it('converts unit amount cents to dollars', () => {
    assert.equal(monthlyPriceFromStripeUnitAmount(50000), 500)
    assert.equal(monthlyPriceFromStripeUnitAmount(null), undefined)
  })
})
