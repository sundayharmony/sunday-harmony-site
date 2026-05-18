import type Stripe from 'stripe'
import { updateClient } from '@/lib/db'
import { getTierFromPriceId, monthlyPriceFromStripeUnitAmount } from '@/lib/stripe-catalog'
import { toBillingStatus } from '@/lib/stripe-billing-status'

export function subscriptionPeriodEndIso(subscription: Stripe.Subscription): string | undefined {
  const end = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end
  return end ? new Date(end * 1000).toISOString() : undefined
}

/** Apply Stripe subscription fields onto the client row (tier, MRR, status). */
export async function applySubscriptionToClient(
  clientId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const item = subscription.items.data[0]
  const priceId = item?.price?.id
  const tier = priceId ? getTierFromPriceId(priceId) : undefined
  const monthly = monthlyPriceFromStripeUnitAmount(item?.price?.unit_amount)

  await updateClient(clientId, {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: String(subscription.customer),
    billing_status: toBillingStatus(subscription.status),
    is_potential: false,
    next_billing_date: subscriptionPeriodEndIso(subscription),
    ...(tier ? { package_tier: tier } : {}),
    ...(monthly != null ? { monthly_price: monthly } : {}),
  })
}
