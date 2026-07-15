import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { mapStripeError } from '../stripe-errors'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('Area 10 Stripe billing security', () => {
  it('requires MFA in the shared admin billing authorization branch', () => {
    const auth = source('src/lib/billing-access.ts')
    assert.match(auth, /session\.user\.role === 'admin'/)
    assert.match(auth, /!session\.user\.mfaVerified/)
    assert.match(auth, /MFA verification required/)
  })

  it('rate limits client-callable billing routes with durable storage', () => {
    const setupIntent = source('src/app/api/billing/setup-intent/route.ts')
    const saveCard = source('src/app/api/billing/save-card/route.ts')
    const paymentMethods = source('src/app/api/billing/payment-methods/route.ts')

    for (const route of [setupIntent, saveCard, paymentMethods]) {
      assert.match(route, /enforceBillingRateLimit/)
    }
    assert.match(source('src/lib/billing-rate-limit.ts'), /rateLimitDurable/)
  })

  it('throws on webhook client update failures so Stripe retries', () => {
    const sync = source('src/lib/stripe-subscription-sync.ts')
    const webhook = source('src/app/api/stripe/webhook/route.ts')

    assert.match(sync, /updateClientForStripeSync/)
    assert.match(sync, /throw new Error\(`Failed to persist Stripe billing state/)
    assert.match(webhook, /releaseStripeWebhookEvent\(event\.id\)/)
    assert.doesNotMatch(webhook, /client_reference_id/)
  })

  it('avoids adopting a Stripe customer linked to another client', () => {
    const customerUtils = source('src/lib/stripe-customer-utils.ts')
    assert.match(customerUtils, /getClientsByStripeCustomerId/)
    assert.match(customerUtils, /linkedToAnotherClient/)
    assert.match(customerUtils, /row\.id !== clientId/)
  })

  it('adds partial unique indexes for non-empty Stripe customer and subscription ids', () => {
    const migration = source('supabase-migration-026-stripe-billing-uniqueness.sql')
    assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_stripe_customer_id_unique/)
    assert.match(migration, /stripe_customer_id IS NOT NULL AND stripe_customer_id <> ''/)
    assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_stripe_subscription_id_unique/)
    assert.match(migration, /stripe_subscription_id IS NOT NULL AND stripe_subscription_id <> ''/)
  })

  it('does not leak generic internal Stripe errors to callers', () => {
    const originalError = console.error
    console.error = () => {}
    try {
      const mapped = mapStripeError(new Error('Missing STRIPE_SECRET_KEY'))
      assert.equal(mapped.status, 500)
      assert.equal(mapped.error, 'Billing service error. Please try again shortly.')
    } finally {
      console.error = originalError
    }

    const card = mapStripeError({
      type: 'StripeCardError',
      message: 'Your card was declined.',
    })
    assert.equal(card.status, 402)
    assert.equal(card.error, 'Your card was declined.')
  })
})
