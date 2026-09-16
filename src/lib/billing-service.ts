import type Stripe from 'stripe'
import { getClientById, getClientsByStripeCustomerId, logActivity, updateClient, type Client } from '@/lib/db'
import {
  decideSavedPaymentMethodCustomer,
  ensureStripeCustomerForClient,
  escapeEmailForStripeSearch,
} from '@/lib/stripe-customer-utils'
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
import {
  applyRepairInvoicePaid,
  billingRequiresActivation,
  defaultRepairFeeCents,
  formatRepairFeeCents,
  isCreditRepairBillingClient,
  parseRepairFeeToCents,
  repairInvoiceMetadata,
  resolveRepairCollectionMode,
  sendRepairInvoiceEmail,
} from '@/lib/credit-repair-billing'
import { normalizeStripeInvoice } from '@/lib/stripe-invoice-utils'

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
  client: { is_potential?: boolean; billing_model?: string | null; lead_type?: string | null },
  opts?: BillingClientOpts
): { error: string; status: number } | null {
  if (opts?.skipPotentialCheck) return null
  if (client.is_potential && billingRequiresActivation(client)) {
    return { error: 'Activate billing for this client before managing subscriptions.', status: 400 }
  }
  return null
}

function rejectMarketingSubscriptionForRepair(
  client: { billing_model?: string | null; lead_type?: string | null }
): { error: string; status: number } | null {
  if (!isCreditRepairBillingClient(client)) return null
  return {
    error: 'This client is billed as a one-time credit repair fee, not a marketing subscription.',
    status: 400,
  }
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

  const listed = await listPaymentMethods(clientId)
  if ('error' in listed) return listed

  const ensured = await ensureStripeCustomerForClient(clientId)
  if (!ensured.ok) return { error: ensured.error, status: ensured.status }

  const intent = await getStripe().setupIntents.create({
    customer: ensured.stripe_customer_id,
    usage: 'off_session',
    payment_method_types: ['card'],
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
  const repairBlocked = rejectMarketingSubscriptionForRepair(client)
  if (repairBlocked) return repairBlocked
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
  const repairBlocked = rejectMarketingSubscriptionForRepair(client)
  if (repairBlocked) return repairBlocked
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

type PaymentMethodRow = {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  isDefault: boolean
}

function defaultPaymentMethodId(customer: Stripe.Customer | Stripe.DeletedCustomer | string): string | undefined {
  if (typeof customer === 'string' || customer.deleted) return undefined
  const raw = customer.invoice_settings?.default_payment_method
  if (typeof raw === 'string') return raw
  return raw?.id
}

function toPaymentMethodRow(pm: Stripe.PaymentMethod, defaultPm?: string): PaymentMethodRow {
  if (pm.card) {
    return {
      id: pm.id,
      brand: pm.card.brand || 'card',
      last4: pm.card.last4 || '????',
      expMonth: pm.card.exp_month || 0,
      expYear: pm.card.exp_year || 0,
      isDefault: pm.id === defaultPm,
    }
  }
  return {
    id: pm.id,
    brand: pm.type === 'link' ? 'Link' : pm.type,
    last4: pm.type === 'link' ? 'saved' : pm.type,
    expMonth: 0,
    expYear: 0,
    isDefault: pm.id === defaultPm,
  }
}

async function listMappedPaymentMethodsForCustomer(customerId: string): Promise<PaymentMethodRow[]> {
  const stripe = getStripe()
  const customer = await stripe.customers.retrieve(customerId)
  const defaultPm = defaultPaymentMethodId(customer)
  const [cards, links] = await Promise.all([
    stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 20 }),
    stripe.paymentMethods.list({ customer: customerId, type: 'link', limit: 10 }),
  ])
  const byId = new Map<string, Stripe.PaymentMethod>()
  for (const pm of [...cards.data, ...links.data]) byId.set(pm.id, pm)
  if (defaultPm && !byId.has(defaultPm)) {
    try {
      const retrieved = await stripe.paymentMethods.retrieve(defaultPm)
      byId.set(retrieved.id, retrieved)
    } catch {
      // Default method may have been detached.
    }
  }
  return [...byId.values()].map(pm => toPaymentMethodRow(pm, defaultPm))
}

async function recoverCustomerWithSavedCards(client: Client): Promise<string | null> {
  const email = client.email?.trim().toLowerCase()
  if (!email) return null

  const stripe = getStripe()
  let candidates: Stripe.Customer[] = []
  try {
    const search = await stripe.customers.search({
      query: `email:'${escapeEmailForStripeSearch(email)}'`,
      limit: 10,
    })
    candidates = search.data
  } catch (err) {
    console.warn('Stripe customer search for saved cards failed:', err)
    try {
      const listed = await stripe.customers.list({ email, limit: 10 })
      candidates = listed.data
    } catch (listErr) {
      console.warn('Stripe customer list for saved cards failed:', listErr)
      return null
    }
  }

  for (const candidate of candidates) {
    if (client.stripe_customer_id?.trim() === candidate.id) continue
    const linked = await getClientsByStripeCustomerId(candidate.id)
    if (linked.some(row => row.id !== client.id)) continue
    const methods = await listMappedPaymentMethodsForCustomer(candidate.id)
    if (methods.length === 0) continue
    await updateClient(client.id, { stripe_customer_id: candidate.id })
    return candidate.id
  }
  return null
}

export async function listPaymentMethods(
  clientId: string
): Promise<{ paymentMethods: PaymentMethodRow[] } | { error: string; status: number }> {
  const client = await getClientById(clientId)
  if (!client) return { error: 'Client not found', status: 404 }

  const customerId = client.stripe_customer_id?.trim()
  let paymentMethods = customerId ? await listMappedPaymentMethodsForCustomer(customerId) : []
  if (paymentMethods.length === 0) {
    const recoveredId = await recoverCustomerWithSavedCards(client)
    if (recoveredId) {
      paymentMethods = await listMappedPaymentMethodsForCustomer(recoveredId)
    }
  }

  return { paymentMethods }
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
  const repairBlocked = rejectMarketingSubscriptionForRepair(existing)
  if (repairBlocked) return repairBlocked

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
  const repairBlocked = rejectMarketingSubscriptionForRepair(client)
  if (repairBlocked) return repairBlocked
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

  const stripe = getStripe()
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
  const pmCustomerId =
    typeof paymentMethod.customer === 'string'
      ? paymentMethod.customer
      : paymentMethod.customer?.id || null
  const linked = pmCustomerId ? await getClientsByStripeCustomerId(pmCustomerId) : []
  const decision = decideSavedPaymentMethodCustomer({
    clientId,
    storedCustomerId: client.stripe_customer_id,
    paymentMethodCustomerId: pmCustomerId,
    clientsLinkedToPmCustomer: linked,
  })
  if (!decision.ok) return { error: decision.error, status: 409 }

  let customerId = decision.customerId
  if (!customerId) {
    const ensured = await ensureStripeCustomerForClient(clientId)
    if (!ensured.ok) return { error: ensured.error, status: ensured.status }
    customerId = ensured.stripe_customer_id
  } else if (client.stripe_customer_id?.trim() !== customerId) {
    await updateClient(clientId, { stripe_customer_id: customerId })
  }

  await attachDefaultPaymentMethod(customerId, paymentMethodId)
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
  } else if (
    !isCreditRepairBillingClient(client) &&
    (client.billing_status === 'trial' || client.billing_status === 'paid')
  ) {
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

export type RepairBillingSnapshot =
  | {
      client: Client
      defaultFeeCents: number | null
      paymentMethods: Array<{
        id: string
        brand: string
        last4: string
        expMonth: number
        expYear: number
        isDefault: boolean
      }>
      invoices: ReturnType<typeof normalizeStripeInvoice>[]
      paid: boolean
    }
  | { error: string; status: number }

function isTrackedRepairInvoice(invoice: Stripe.Invoice): boolean {
  if (invoice.status === 'draft' || invoice.status === 'void') return false
  if (invoice.metadata?.billing_model === 'credit_repair_one_time') return true
  const parentSub = invoice.parent?.subscription_details?.subscription
  return !parentSub
}

async function listRepairInvoicesForCustomer(customerId: string) {
  const list = await getStripe().invoices.list({ customer: customerId, limit: 24 })
  return list.data.filter(isTrackedRepairInvoice).map(normalizeStripeInvoice)
}

export async function getRepairBillingSnapshot(clientId: string): Promise<RepairBillingSnapshot> {
  const client = await getClientById(clientId)
  if (!client) return { error: 'Client not found', status: 404 }
  if (!isCreditRepairBillingClient(client)) {
    return { error: 'This client is not a credit repair client.', status: 400 }
  }

  const paymentMethods = await listPaymentMethods(clientId)
  if ('error' in paymentMethods) return paymentMethods

  const customerId = client.stripe_customer_id?.trim()
  const invoices = customerId ? await listRepairInvoicesForCustomer(customerId) : []

  return {
    client,
    defaultFeeCents: defaultRepairFeeCents(),
    paymentMethods: paymentMethods.paymentMethods,
    invoices,
    paid: Boolean(client.repair_fee_paid_at) || client.billing_status === 'paid',
  }
}

export type ChargeRepairFeeResult =
  | {
      ok: true
      client: Client
      message: string
      invoiceId: string
      hostedInvoiceUrl?: string | null
      status: string
      emailed: boolean
      charged: boolean
    }
  | { error: string; status: number }

async function deliverRepairInvoiceCopy(params: {
  client: Client
  invoice: Stripe.Invoice
  amountCents: number
  paid: boolean
}): Promise<{ invoice: Stripe.Invoice; emailed: boolean }> {
  const stripe = getStripe()
  let invoice = params.invoice
  let emailed = false

  if (invoice.status === 'open') {
    try {
      invoice = await stripe.invoices.sendInvoice(invoice.id)
      emailed = true
    } catch (err) {
      console.error('Stripe sendInvoice for repair fee failed:', err)
    }
  }

  if (!invoice.hosted_invoice_url && invoice.id) {
    try {
      invoice = await stripe.invoices.retrieve(invoice.id)
    } catch (err) {
      console.error('Stripe retrieve repair invoice failed:', err)
    }
  }

  try {
    const smtpSent = await sendRepairInvoiceEmail({
      to: params.client.email,
      clientName: params.client.name || 'there',
      amountCents: params.amountCents,
      paid: params.paid,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoiceNumber: invoice.number,
    })
    if (smtpSent) emailed = true
  } catch (err) {
    console.error('SMTP repair invoice email failed:', err)
  }

  return { invoice, emailed }
}

export async function adminChargeCreditRepairFee(
  clientId: string,
  input: { amount?: unknown; sendInvoice?: boolean; description?: string }
): Promise<ChargeRepairFeeResult> {
  const client = await getClientById(clientId)
  if (!client) return { error: 'Client not found', status: 404 }
  if (!isCreditRepairBillingClient(client)) {
    return { error: 'This client is not a credit repair client.', status: 400 }
  }
  if (client.stripe_subscription_id?.trim()) {
    return {
      error: 'This client has a marketing subscription. Cancel it before charging a one-time repair fee.',
      status: 400,
    }
  }

  const parsed = parseRepairFeeToCents(input.amount)
  if ('error' in parsed) return { error: parsed.error, status: 400 }

  const description = input.description?.trim() || 'Credit repair one-time fee'

  const pms = await listPaymentMethods(clientId)
  if ('error' in pms) return pms
  const defaultPm = pms.paymentMethods.find(pm => pm.isDefault) ?? pms.paymentMethods[0]
  const mode = resolveRepairCollectionMode({
    preferSendInvoice: Boolean(input.sendInvoice),
    hasCard: Boolean(defaultPm),
  })
  const chargeCard = mode === 'charge_card'

  const ensured = await ensureStripeCustomerForClient(clientId)
  if (!ensured.ok) return { error: ensured.error, status: ensured.status }

  await updateClient(clientId, {
    billing_model: 'credit_repair_one_time',
    repair_fee_cents: parsed.cents,
    monthly_price: 0,
    package_tier: 'free',
  })

  const stripe = getStripe()
  const invoice = await stripe.invoices.create({
    customer: ensured.stripe_customer_id,
    currency: 'usd',
    collection_method: chargeCard ? 'charge_automatically' : 'send_invoice',
    auto_advance: false,
    description,
    metadata: repairInvoiceMetadata({
      clientId,
      emailReceiptOnPay: !chargeCard,
    }),
    pending_invoice_items_behavior: 'exclude',
    ...(!chargeCard ? { days_until_due: 7 } : {}),
    ...(defaultPm && chargeCard ? { default_payment_method: defaultPm.id } : {}),
  })

  if (!invoice.id) {
    return { error: 'Failed to create Stripe invoice', status: 500 }
  }

  await stripe.invoices.addLines(invoice.id, {
    lines: [
      {
        amount: parsed.cents,
        description,
      },
    ],
  })

  let current: Stripe.Invoice = await stripe.invoices.finalizeInvoice(invoice.id)

  if (chargeCard && defaultPm) {
    current = await stripe.invoices.pay(current.id, {
      off_session: true,
      payment_method: defaultPm.id,
    })
    if (current.status === 'paid') {
      await applyRepairInvoicePaid(clientId, current)
    } else {
      await updateClient(clientId, {
        stripe_repair_invoice_id: current.id,
        repair_fee_cents: parsed.cents,
        billing_status: current.status === 'open' ? 'unpaid' : client.billing_status,
      })
    }
  } else {
    await updateClient(clientId, {
      billing_model: 'credit_repair_one_time',
      billing_status: 'not_started',
      stripe_repair_invoice_id: current.id,
      repair_fee_cents: parsed.cents,
    })
  }

  const paid = current.status === 'paid'
  const delivered = await deliverRepairInvoiceCopy({
    client,
    invoice: current,
    amountCents: parsed.cents,
    paid,
  })
  current = delivered.invoice

  const updated = await readClientOr404(clientId)
  if ('error' in updated) return updated

  const emailedNote = delivered.emailed
    ? ` Invoice emailed to ${client.email}.`
    : ' Invoice created; email could not be sent — share the invoice link.'

  let message: string
  if (paid) {
    message = `Charged ${formatRepairFeeCents(parsed.cents)} for credit repair.${emailedNote}`
  } else if (!defaultPm && !input.sendInvoice) {
    message = `No card on file — sent a ${formatRepairFeeCents(parsed.cents)} invoice to ${client.email} instead.`
  } else {
    message = `Invoice for ${formatRepairFeeCents(parsed.cents)} emailed to ${client.email}.`
  }

  return {
    ok: true,
    client: updated,
    invoiceId: current.id,
    hostedInvoiceUrl: current.hosted_invoice_url,
    status: current.status || 'open',
    emailed: delivered.emailed,
    charged: paid,
    message,
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
