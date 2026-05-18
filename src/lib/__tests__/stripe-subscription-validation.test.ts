import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type Stripe from 'stripe'
import { validateSubscriptionPayment } from '../stripe-subscription-validation'

function sub(
  partial: Partial<Stripe.Subscription> & { status: Stripe.Subscription.Status }
): Stripe.Subscription {
  return partial as Stripe.Subscription
}

describe('validateSubscriptionPayment', () => {
  it('accepts active and trialing subscriptions', () => {
    assert.deepEqual(validateSubscriptionPayment(sub({ status: 'active' })), { ok: true })
    assert.deepEqual(validateSubscriptionPayment(sub({ status: 'trialing' })), { ok: true })
  })

  it('requires action when payment intent needs authentication', () => {
    const result = validateSubscriptionPayment(
      sub({
        status: 'incomplete',
        latest_invoice: {
          payment_intent: { status: 'requires_action', client_secret: 'pi_secret' },
        } as Stripe.Invoice,
      })
    )
    assert.equal('requiresAction' in result && result.requiresAction, true)
    if ('requiresAction' in result) {
      assert.equal(result.clientSecret, 'pi_secret')
    }
  })

  it('rejects incomplete subscriptions without successful payment', () => {
    const result = validateSubscriptionPayment(sub({ status: 'incomplete' }))
    assert.equal('error' in result, true)
  })
})
