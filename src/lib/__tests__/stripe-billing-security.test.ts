import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { mapStripeError } from '../stripe-errors'
import { decideStripeCustomerAttach } from '../stripe-customer-utils'

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

  it('does not adopt a Stripe customer linked to another client', () => {
    const customerUtils = source('src/lib/stripe-customer-utils.ts')
    const webhook = source('src/app/api/stripe/webhook/route.ts')
    assert.match(customerUtils, /getClientsByStripeCustomerId/)
    assert.match(customerUtils, /linkedToAnotherClient/)
    assert.match(customerUtils, /row\.id !== clientId/)
    assert.match(customerUtils, /decideStripeCustomerAttach/)
    assert.match(webhook, /attachStripeCustomerFromSetupIntent/)
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

describe('setup_intent customer attach ownership', () => {
  const client = { id: 'client-a', stripe_customer_id: '' }

  it('attaches when the client exists and the customer is unowned', () => {
    assert.deepEqual(
      decideStripeCustomerAttach({
        client,
        stripeCustomerId: 'cus_new',
        clientsAlreadyLinkedToCustomer: [],
      }),
      { attach: true }
    )
  })

  it('skips unknown clients', () => {
    assert.deepEqual(
      decideStripeCustomerAttach({
        client: null,
        stripeCustomerId: 'cus_new',
        clientsAlreadyLinkedToCustomer: [],
      }),
      { attach: false, reason: 'client_not_found' }
    )
  })

  it('does not overwrite a different customer already on the client', () => {
    assert.deepEqual(
      decideStripeCustomerAttach({
        client: { id: 'client-a', stripe_customer_id: 'cus_existing' },
        stripeCustomerId: 'cus_other',
        clientsAlreadyLinkedToCustomer: [],
      }),
      { attach: false, reason: 'would_overwrite_existing_customer' }
    )
  })

  it('does not steal a customer linked to another client', () => {
    assert.deepEqual(
      decideStripeCustomerAttach({
        client,
        stripeCustomerId: 'cus_shared',
        clientsAlreadyLinkedToCustomer: [{ id: 'client-b' }],
      }),
      { attach: false, reason: 'customer_owned_by_other_client' }
    )
  })

  it('skips a no-op when the client already has that customer', () => {
    assert.deepEqual(
      decideStripeCustomerAttach({
        client: { id: 'client-a', stripe_customer_id: 'cus_same' },
        stripeCustomerId: 'cus_same',
        clientsAlreadyLinkedToCustomer: [{ id: 'client-a' }],
      }),
      { attach: false, reason: 'already_attached' }
    )
  })
})
