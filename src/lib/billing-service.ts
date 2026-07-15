import type Stripe from 'stripe'
import { getClientById, logActivity, updateClient, type Client } from '@/lib/db'
import { ensureStripeCustomerForClient } from '@/lib/stripe-customer-utils'
import {
  getStripePriceIdForTier,
  getTierFromPriceId,
  isFreeTier,
  isStripeBillableTier,
  monthlyPriceFromStripeUnitAmount,
  TIER_LIST_PRICES,
  type PackageTier,
} from '@/lib/stripe-catalog'
import { applySubscriptionToClient } from '@/lib/stripe-subscription-sync'
import { getStripe } from '@/lib/stripe'
import { isStripeMissingResource } from '@/lib/stripe-errors'
import {
  SUBSCRIPTION_EXPAND,
  validateSubscriptionPayment,
} from '@/lib/stripe-subscription-validation'

export type SubscribeResult =
  | { subscription: Stripe.Subscription }
  | { requiresAction: true; clientSecret: string }
  | { error: string; status: number }

async function clearStaleSubscriptionId(clientId: string): Promise<void> {
  await updateClient(clientId, { stripe_subscription_id: '' })
}

async function retrieveSubscriptionOrClear(
  clientId: string,
  subId: string
): Promise<Stripe.Subscription | { error: string; status: number }> {
  const stripe = getStripe()
  try {
    return await stripe.subscriptions.retrieve(subId, {
      expand: [...SUBSCRIPTION_EXPAND],
    })
  } catch (err) {
    if (isStripeMissingResource(err)) {
      await clearStaleSubscriptionId(clientId)
      return { error: 'No active subscription on file', status: 400 }
    }
    throw err
  }
}

type BillingClientOpts = { skipPotentialCheck?: boolean }

export function contractedMonthlyPriceForTier(tier: PackageTier): number {
  return isFreeTier(tier) ? 0 : TIER_LIST_PRICES[tier]
}

export function activateBillingStatusForTier(
  tier: PackageTier,
  currentStatus?: string
): 'paid' | 'not_started' {
  if (isFreeTier(tier)) return 'paid'
  return currentStatus === 'paid' ? 'paid' : 'not_started'
}

function rejectPotential(
  client: { is_potential?: boolean },
  opts?: BillingClientOpts
): { error: string; status: number } | null {
  if (opts?.skipPotentialCheck) return null
  if (client.is_potential) {
    return { error: 'Activate billing for this client before managing subscriptions.', status: 400 }
  }
  return null
}

export async function cleanupStripeForClient(clientId: string): Promise<void> {
  const client = await getClientById(clientId)
  if (!client) return

  const stripe = getStripe()
  const subId = client.stripe_subscription_id?.trim()
  if (subId) {
    try {
      await stripe.subscriptions.cancel(subId)
    } catch (err) {
      console.error('cleanupStripeForClient cancel subscription:', err)
    }
  }

  const customerId = client.stripe_customer_id?.trim()
  if (customerId) {
    try {
      await stripe.customers.del(customerId)
    } catch (err) {
      console.error('cleanupStripeForClient delete customer:', err)
    }
  }
}

export async function createSetupIntentForClient(
  clientId: string
): Promise<{ clientSecret: string; stripeCustomerId: string } | { error: string; status: number }> {
  const client = await getClientById(clientId)
  if (!client) return { error: 'Client not found', status: 404 }
  const blocked = rejectPotential(client)
  if (blocked) return blocked

  const ensured = await ensureStripeCustomerForClient(clientId)
  if (!ensured.ok) return { error: ensured.error, status: ensured.status }

  const intent = await getStripe().setupIntents.create({
    customer: ensured.stripe_customer_id,
    metadata: { client_id: clientId },
  })

  if (!intent.client_secret) {
    return { error: 'Failed to create setup intent', status: 500 }
  }

  return { clientSecret: intent.client_secret, stripeCustomerId: ensured.stripe_customer_id }
}

async function attachDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<void> {
  const stripe = getStripe()
  try {
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId })
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code !== 'resource_already_exists') throw err
  }
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  })
}

/** Assign free testing tier — no Stripe subscription; dashboard access without payment. */
export async function setClientToFreeTier(
  clientId: string,
  opts?: BillingClientOpts
): Promise<{ subscription: null } | { error: string; status: number }> {
  const client = await getClientById(clientId)
  if (!client) return { error: 'Client not found', status: 404 }
  const blocked = rejectPotential(client, opts)
  if (blocked) return blocked

  const subId = client.stripe_subscription_id?.trim()
  if (subId) {
    try {
      await getStripe().subscriptions.cancel(subId)
    } catch (err) {
      console.error('setClientToFreeTier cancel subscription:', err)
    }
  }

  await updateClient(clientId, {
    package_tier: 'free',
    monthly_price: TIER_LIST_PRICES.free,
    billing_status: 'paid',
    is_potential: false,
    stripe_subscription_id: '',
    next_billing_date: undefined,
  })

  return { subscription: null }
}

export async function createOrUpdateSubscription(
  clientId: string,
  tier: PackageTier,
  paymentMethodId: string,
  opts?: BillingClientOpts
): Promise<SubscribeResult> {
  const client = await getClientById(clientId)
  if (!client) return { error: 'Client not found', status: 404 }
  const blocked = rejectPotential(client, opts)
  if (blocked) return blocked

  if (isFreeTier(tier)) {
    return {
      error: 'Free tier does not use card checkout. Switch plans in billing or ask your admin.',
      status: 400,
    }
  }

  const priceId = getStripePriceIdForTier(tier)
  if (!priceId) {
    return { error: `Missing Stripe price for tier "${tier}"`, status: 500 }
  }

  const ensured = await ensureStripeCustomerForClient(clientId)
  if (!ensured.ok) return { error: ensured.error, status: ensured.status }

  await attachDefaultPaymentMethod(ensured.stripe_customer_id, paymentMethodId)

  const stripe = getStripe()
  let subscription: Stripe.Subscription

  const existingSubId = client.stripe_subscription_id?.trim()
  if (existingSubId) {
    const existing = await retrieveSubscriptionOrClear(clientId, existingSubId)
    if ('error' in existing) return existing
    const itemId = existing.items.data[0]?.id
    if (!itemId) return { error: 'Subscription has no line items', status: 500 }
    subscription = await stripe.subscriptions.update(existingSubId, {
      items: [{ id: itemId, price: priceId }],
      default_payment_method: paymentMethodId,
      cancel_at_period_end: false,
      metadata: { client_id: clientId },
      expand: [...SUBSCRIPTION_EXPAND],
    })
  } else {
    subscription = await stripe.subscriptions.create({
      customer: ensured.stripe_customer_id,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      metadata: { client_id: clientId },
      expand: [...SUBSCRIPTION_EXPAND],
    })
  }

  const validation = validateSubscriptionPayment(subscription)
  if ('requiresAction' in validation) {
    return { requiresAction: true, clientSecret: validation.clientSecret }
  }
  if ('error' in validation) {
    return { error: validation.error, status: 402 }
  }

  await applySubscriptionToClient(clientId, subscription)
  return { subscription }
}

export async function changeSubscriptionTier(
  clientId: string,
  tier: PackageTier,
  opts?: BillingClientOpts
): Promise<{ subscription: Stripe.Subscription | null } | { error: string; status: number }> {
  const client = await getClientById(clientId)
  if (!client) return { error: 'Client not found', status: 404 }
  const blocked = rejectPotential(client, opts)
  if (blocked) return blocked

  if (isFreeTier(tier)) {
    return setClientToFreeTier(clientId, opts)
  }

  const subId = client.stripe_subscription_id?.trim()
  if (!subId) {
    return {
      error: 'No active Stripe subscription. Use Subscribe to add a payment method first.',
      status: 400,
    }
  }

  if (!isStripeBillableTier(tier)) {
    return { error: 'Invalid tier', status: 400 }
  }

  const priceId = getStripePriceIdForTier(tier)
  if (!priceId) return { error: `Missing Stripe price for tier "${tier}"`, status: 500 }

  const existing = await retrieveSubscriptionOrClear(clientId, subId)
  if ('error' in existing) return existing

  const itemId = existing.items.data[0]?.id
  if (!itemId) return { error: 'Subscription has no line items', status: 500 }

  const stripe = getStripe()
  const subscription = await stripe.subscriptions.update(subId, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: 'create_prorations',
    metadata: { client_id: clientId },
    expand: [...SUBSCRIPTION_EXPAND],
  })

  await applySubscriptionToClient(clientId, subscription)
  return { subscription }
}

export type CancelAction = 'cancel_at_period_end' | 'resume' | 'cancel_immediately'

export async function cancelSubscription(
  clientId: string,
  action: CancelAction
): Promise<{ subscription: Stripe.Subscription | null } | { error: string; status: number }> {
  const client = await getClientById(clientId)
  if (!client) return { error: 'Client not found', status: 404 }
  const blocked = rejectPotential(client)
  if (blocked) return blocked

  const subId = client.stripe_subscription_id?.trim()
  if (!subId) return { error: 'No Stripe subscription on file', status: 400 }

  const existing = await retrieveSubscriptionOrClear(clientId, subId)
  if ('error' in existing) return existing

  const stripe = getStripe()

  if (action === 'cancel_immediately') {
    await stripe.subscriptions.cancel(subId)
    await updateClient(clientId, {
      stripe_subscription_id: '',
      billing_status: 'not_started',
      next_billing_date: undefined,
    })
    return { subscription: null }
  }

  if (action === 'cancel_at_period_end') {
    const subscription = await stripe.subscriptions.update(subId, { cancel_at_period_end: true })
    await applySubscriptionToClient(clientId, subscription)
    return { subscription }
  }

  const subscription = await stripe.subscriptions.update(subId, { cancel_at_period_end: false })
  await applySubscriptionToClient(clientId, subscription)
  return { subscription }
}

export async function listPaymentMethods(
  clientId: string
): Promise<
  | {
      paymentMethods: Array<{
        id: string
        brand: string
        last4: string
        expMonth: number
        expYear: number
        isDefault: boolean
      }>
    }
  | { error: string; status: number }
> {
  const client = await getClientById(clientId)
  if (!client) return { error: 'Client not found', status: 404 }
  const customerId = client.stripe_customer_id?.trim()
  if (!customerId) return { paymentMethods: [] }

  const stripe = getStripe()
  const customer = await stripe.customers.retrieve(customerId)
  const defaultPm =
    typeof customer !== 'string' && !customer.deleted
      ? (typeof customer.invoice_settings?.default_payment_method === 'string'
          ? customer.invoice_settings.default_payment_method
          : customer.invoice_settings?.default_payment_method?.id)
      : undefined

  const list = await stripe.paymentMethods.list({ customer: customerId, type: 'card' })

  return {
    paymentMethods: list.data.map(pm => ({
      id: pm.id,
      brand: pm.card?.brand || 'card',
      last4: pm.card?.last4 || '????',
      expMonth: pm.card?.exp_month || 0,
      expYear: pm.card?.exp_year || 0,
      isDefault: pm.id === defaultPm,
    })),
  }
}

export async function setDefaultPaymentMethod(
  clientId: string,
  paymentMethodId: string
): Promise<{ ok: true } | { error: string; status: number }> {
  const client = await getClientById(clientId)
  if (!client) return { error: 'Client not found', status: 404 }
  const customerId = client.stripe_customer_id?.trim()
  if (!customerId) return { error: 'No Stripe customer linked', status: 400 }

  const stripe = getStripe()
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
  if (pm.customer !== customerId) {
    return { error: 'Payment method does not belong to this client', status: 403 }
  }

  await attachDefaultPaymentMethod(customerId, paymentMethodId)
  return { ok: true }
}

export async function detachPaymentMethod(
  clientId: string,
  paymentMethodId: string
): Promise<{ ok: true } | { error: string; status: number }> {
  const client = await getClientById(clientId)
  if (!client) return { error: 'Client not found', status: 404 }
  const customerId = client.stripe_customer_id?.trim()
  if (!customerId) return { error: 'No Stripe customer linked', status: 400 }

  const stripe = getStripe()
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
  if (pm.customer !== customerId) {
    return { error: 'Payment method does not belong to this client', status: 403 }
  }

  await stripe.paymentMethods.detach(paymentMethodId)
  return { ok: true }
}

export type AdminClientResult =
  | {
      ok: true
      client: Client
      message: string
      requiresClientAction?: boolean
    }
  | { error: string; status: number }

async function readClientOr404(clientId: string): Promise<Client | { error: string; status: number }> {
  const client = await getClientById(clientId)
  if (!client) return { error: 'Client not found', status: 404 }
  return client
}

export async function adminSetClientPlan(
  clientId: string,
  tier: PackageTier
): Promise<AdminClientResult> {
  const existing = await readClientOr404(clientId)
  if ('error' in existing) return existing

  if (!isFreeTier(tier) && !isStripeBillableTier(tier)) {
    return { error: 'Invalid tier', status: 400 }
  }

  if (isFreeTier(tier)) {
    const freeResult = await setClientToFreeTier(clientId, { skipPotentialCheck: true })
    if ('error' in freeResult) return freeResult
    const updated = await readClientOr404(clientId)
    if ('error' in updated) return updated
    return {
      ok: true,
      client: updated,
      message: 'Plan saved as Free (testing).',
    }
  }

  await updateClient(clientId, {
    package_tier: tier,
    monthly_price: contractedMonthlyPriceForTier(tier),
  })

  const updated = await readClientOr404(clientId)
  if ('error' in updated) return updated

  return {
    ok: true,
    client: updated,
    message: `Plan set to ${tier.replace(/_/g, ' ')} ($${contractedMonthlyPriceForTier(tier).toLocaleString()}/mo).`,
  }
}

export async function adminActivateBilling(clientId: string): Promise<AdminClientResult> {
  const client = await readClientOr404(clientId)
  if ('error' in client) return client
  const tier = (client.package_tier as PackageTier) || 'spark'
  await updateClient(clientId, {
    is_potential: false,
    billing_status: activateBillingStatusForTier(tier, client.billing_status),
  })
  const updated = await readClientOr404(clientId)
  if ('error' in updated) return updated
  return {
    ok: true,
    client: updated,
    message: 'Billing activated. Use Start subscription when card details are on file.',
  }
}

export async function adminStartSubscription(
  clientId: string,
  tierOverride?: PackageTier
): Promise<AdminClientResult> {
  const client = await readClientOr404(clientId)
  if ('error' in client) return client
  if (client.is_potential) {
    return { error: 'Activate billing before starting a subscription.', status: 400 }
  }

  const tier = tierOverride ?? ((client.package_tier as PackageTier) || 'spark')
  if (!isStripeBillableTier(tier)) {
    return { error: 'Choose a paid plan before starting Stripe billing.', status: 400 }
  }

  if (!client.stripe_customer_id?.trim()) {
    return { error: 'No Stripe customer linked. Create/link customer first.', status: 400 }
  }

  const pms = await listPaymentMethods(clientId)
  if ('error' in pms) return pms
  const defaultPm = pms.paymentMethods.find(pm => pm.isDefault) ?? pms.paymentMethods[0]
  if (!defaultPm) {
    return { error: 'No card on file. Ask the client to add a payment method first.', status: 400 }
  }

  const result = await createOrUpdateSubscription(clientId, tier, defaultPm.id, {
    skipPotentialCheck: true,
  })
  if ('error' in result) return result
  if ('requiresAction' in result) {
    const updated = await readClientOr404(clientId)
    if ('error' in updated) return updated
    return {
      ok: true,
      client: updated,
      requiresClientAction: true,
      message:
        'Card verification is required. Ask the client to open Billing and complete authentication.',
    }
  }

  const updated = await readClientOr404(clientId)
  if ('error' in updated) return updated
  return {
    ok: true,
    client: updated,
    message: 'Stripe subscription started and synced.',
  }
}

export async function savePaymentMethodForClient(
  clientId: string,
  paymentMethodId: string
): Promise<{ ok: true } | { error: string; status: number }> {
  const client = await getClientById(clientId)
  if (!client) return { error: 'Client not found', status: 404 }
  const blocked = rejectPotential(client)
  if (blocked) return blocked

  const ensured = await ensureStripeCustomerForClient(clientId)
  if (!ensured.ok) return { error: ensured.error, status: ensured.status }
  await attachDefaultPaymentMethod(ensured.stripe_customer_id, paymentMethodId)
  return { ok: true }
}

export type BillingStatusSnapshot =
  | {
      client: Client
      stripe: {
        hasSubscription: boolean
        subscriptionStatus?: Stripe.Subscription.Status
        tier?: PackageTier
        monthlyPrice?: number
      }
      paymentMethods: { count: number; hasDefault: boolean }
      drift: string[]
    }
  | { error: string; status: number }

type StripeStatusSnapshot = {
  hasSubscription: boolean
  subscriptionStatus?: Stripe.Subscription.Status
  tier?: PackageTier
  monthlyPrice?: number
}

export async function getBillingStatusSnapshot(clientId: string): Promise<BillingStatusSnapshot> {
  const client = await getClientById(clientId)
  if (!client) return { error: 'Client not found', status: 404 }

  const paymentMethodsResult = await listPaymentMethods(clientId)
  if ('error' in paymentMethodsResult) return paymentMethodsResult

  const stripeSnapshot: StripeStatusSnapshot = {
    hasSubscription: false,
  }
  const drift: string[] = []
  const subId = client.stripe_subscription_id?.trim()

  if (subId) {
    try {
      const subscription = await getStripe().subscriptions.retrieve(subId, {
        expand: [...SUBSCRIPTION_EXPAND],
      })
      stripeSnapshot.hasSubscription = true
      stripeSnapshot.subscriptionStatus = subscription.status
      const item = subscription.items.data[0]
      const stripeTier = item?.price?.id ? getTierFromPriceId(item.price.id) : undefined
      stripeSnapshot.tier = stripeTier
      stripeSnapshot.monthlyPrice = monthlyPriceFromStripeUnitAmount(item?.price?.unit_amount)
      if (stripeTier && stripeTier !== client.package_tier) {
        drift.push(`DB plan (${client.package_tier}) differs from Stripe plan (${stripeTier}).`)
      }
      if (
        stripeSnapshot.monthlyPrice != null &&
        Math.abs((client.monthly_price || 0) - stripeSnapshot.monthlyPrice) > 0.001
      ) {
        drift.push(
          `DB monthly price ($${client.monthly_price}) differs from Stripe ($${stripeSnapshot.monthlyPrice}).`
        )
      }
    } catch (err) {
      if (isStripeMissingResource(err)) {
        drift.push('Stored subscription id no longer exists in Stripe.')
      } else {
        throw err
      }
    }
  } else if (client.billing_status === 'trial' || client.billing_status === 'paid') {
    drift.push('Client is marked paid/trial but has no Stripe subscription id.')
  }

  if (client.is_potential && subId) {
    drift.push('Client is still marked potential while a Stripe subscription is attached.')
  }
  if (!client.is_potential && !isFreeTier(client.package_tier) && !subId && client.billing_status !== 'not_started') {
    drift.push('Billing status should be not_started until a subscription exists.')
  }

  return {
    client,
    stripe: stripeSnapshot,
    paymentMethods: {
      count: paymentMethodsResult.paymentMethods.length,
      hasDefault: paymentMethodsResult.paymentMethods.some(pm => pm.isDefault),
    },
    drift,
  }
}

export async function logBillingActivity(
  clientId: string,
  actorEmail: string,
  details: string
): Promise<void> {
  await logActivity({
    action: 'updated',
    entity_type: 'client',
    entity_id: clientId,
    actor_email: actorEmail,
    details,
  })
}
