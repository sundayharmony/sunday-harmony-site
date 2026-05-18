import type Stripe from 'stripe'

export type SubscriptionPaymentValidation =
  | { ok: true }
  | { requiresAction: true; clientSecret: string }
  | { error: string }

function paymentIntentFromSubscription(
  subscription: Stripe.Subscription
): Stripe.PaymentIntent | null {
  const invoice = subscription.latest_invoice
  if (!invoice || typeof invoice !== 'object') return null
  const pi = (invoice as Stripe.Invoice & { payment_intent?: Stripe.PaymentIntent | string | null })
    .payment_intent
  if (!pi || typeof pi !== 'object') return null
  return pi
}

/** Returns whether subscription payment succeeded or needs client-side authentication. */
export function validateSubscriptionPayment(
  subscription: Stripe.Subscription
): SubscriptionPaymentValidation {
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return { ok: true }
  }

  const pi = paymentIntentFromSubscription(subscription)
  if (pi?.status === 'requires_action' && pi.client_secret) {
    return { requiresAction: true, clientSecret: pi.client_secret }
  }
  if (pi?.status === 'succeeded') {
    return { ok: true }
  }

  if (
    subscription.status === 'incomplete' ||
    subscription.status === 'past_due' ||
    subscription.status === 'unpaid'
  ) {
    return { error: 'Payment did not complete. Please try again or use a different card.' }
  }

  return { error: `Subscription is ${subscription.status}. Payment was not completed.` }
}

export const SUBSCRIPTION_EXPAND = ['latest_invoice.payment_intent'] as const
