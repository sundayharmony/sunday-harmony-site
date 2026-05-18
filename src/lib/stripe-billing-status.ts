import type Stripe from 'stripe'

export type AppBillingStatus = 'not_started' | 'trial' | 'paid' | 'past_due' | 'unpaid'

export function toBillingStatus(status: Stripe.Subscription.Status): AppBillingStatus {
  if (status === 'trialing') return 'trial'
  if (status === 'active') return 'paid'
  if (status === 'past_due') return 'past_due'
  if (status === 'unpaid' || status === 'incomplete' || status === 'incomplete_expired') return 'unpaid'
  return 'not_started'
}
