import { getStripe } from '@/lib/stripe'
import { getClientById, getClientsByStripeCustomerId, updateClient } from '@/lib/db'
import { updateClientForStripeSync } from '@/lib/stripe-subscription-sync'

export type StripeCustomerAttachDecision =
  | { attach: true }
  | {
      attach: false
      reason:
        | 'client_not_found'
        | 'already_attached'
        | 'would_overwrite_existing_customer'
        | 'customer_owned_by_other_client'
    }

/** Pure ownership check used by setup_intent.succeeded before writing stripe_customer_id. */
export function decideStripeCustomerAttach(params: {
  client: { id: string; stripe_customer_id?: string | null } | null | undefined
  stripeCustomerId: string
  clientsAlreadyLinkedToCustomer: { id: string }[]
}): StripeCustomerAttachDecision {
  const client = params.client
  if (!client) return { attach: false, reason: 'client_not_found' }

  const existing = client.stripe_customer_id?.trim() || ''
  if (existing && existing === params.stripeCustomerId) {
    return { attach: false, reason: 'already_attached' }
  }
  if (existing && existing !== params.stripeCustomerId) {
    return { attach: false, reason: 'would_overwrite_existing_customer' }
  }
  if (params.clientsAlreadyLinkedToCustomer.some((row) => row.id !== client.id)) {
    return { attach: false, reason: 'customer_owned_by_other_client' }
  }
  return { attach: true }
}

/** When a client saves a card, the payment method's Stripe customer is the source of truth. */
export function decideSavedPaymentMethodCustomer(params: {
  clientId: string
  storedCustomerId?: string | null
  paymentMethodCustomerId?: string | null
  clientsLinkedToPmCustomer: { id: string }[]
}): { ok: true; customerId: string | null } | { ok: false; error: string } {
  const pmCustomer = params.paymentMethodCustomerId?.trim() || ''
  if (!pmCustomer) {
    return { ok: true, customerId: params.storedCustomerId?.trim() || null }
  }
  if (params.clientsLinkedToPmCustomer.some(row => row.id !== params.clientId)) {
    return { ok: false, error: 'This card is already linked to another client.' }
  }
  return { ok: true, customerId: pmCustomer }
}

export async function attachStripeCustomerFromSetupIntent(
  clientId: string,
  stripeCustomerId: string
): Promise<'attached' | 'skipped'> {
  const client = await getClientById(clientId)
  const linked = await getClientsByStripeCustomerId(stripeCustomerId)
  const decision = decideStripeCustomerAttach({
    client,
    stripeCustomerId,
    clientsAlreadyLinkedToCustomer: linked,
  })
  if (!decision.attach) {
    if (decision.reason !== 'already_attached' && decision.reason !== 'client_not_found') {
      console.warn(
        `Skipping setup_intent customer attach for client ${clientId}: ${decision.reason}`
      )
    }
    return 'skipped'
  }
  await updateClientForStripeSync(clientId, { stripe_customer_id: stripeCustomerId })
  return 'attached'
}

export function escapeEmailForStripeSearch(email: string): string {
  return email.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export type EnsureStripeCustomerOutcome = 'existing' | 'linked' | 'created'

export async function ensureStripeCustomerForClient(
  clientId: string
): Promise<
  | { ok: true; stripe_customer_id: string; outcome: EnsureStripeCustomerOutcome }
  | { ok: false; error: string; status: number }
> {
  const client = await getClientById(clientId)
  if (!client) return { ok: false, error: 'Client not found', status: 404 }
  if (!client.email?.trim()) {
    return { ok: false, error: 'Client must have an email to create a Stripe customer', status: 400 }
  }

  const stripe = getStripe()
  const normalizedEmail = client.email.trim().toLowerCase()

  if (client.stripe_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(client.stripe_customer_id)
      if (existing && !('deleted' in existing && existing.deleted)) {
        return { ok: true, stripe_customer_id: client.stripe_customer_id, outcome: 'existing' }
      }
    } catch {
      await updateClient(clientId, { stripe_customer_id: '' })
    }
  }

  let stripeCustomerId: string | null = null
  let outcome: EnsureStripeCustomerOutcome = 'created'

  try {
    const search = await stripe.customers.search({
      query: `email:'${escapeEmailForStripeSearch(normalizedEmail)}'`,
      limit: 10,
    })
    let fallbackId: string | null = null
    for (const candidate of search.data) {
      const linkedClients = await getClientsByStripeCustomerId(candidate.id)
      if (linkedClients.some((row) => row.id !== clientId)) continue
      if (!fallbackId) fallbackId = candidate.id
      const [cards, links] = await Promise.all([
        stripe.paymentMethods.list({ customer: candidate.id, type: 'card', limit: 1 }),
        stripe.paymentMethods.list({ customer: candidate.id, type: 'link', limit: 1 }),
      ])
      if (cards.data.length > 0 || links.data.length > 0) {
        stripeCustomerId = candidate.id
        outcome = 'linked'
        break
      }
    }
    if (!stripeCustomerId && fallbackId) {
      stripeCustomerId = fallbackId
      outcome = 'linked'
    }
  } catch (err) {
    console.warn('Stripe customer search failed, creating new customer:', err)
  }

  if (!stripeCustomerId) {
    const created = await stripe.customers.create({
      email: normalizedEmail,
      name: client.name || undefined,
      metadata: {
        client_id: client.id,
        business: client.business || '',
      },
    })
    stripeCustomerId = created.id
    outcome = 'created'
  }

  const updated = await updateClient(clientId, { stripe_customer_id: stripeCustomerId })
  if (!updated) return { ok: false, error: 'Failed to save Stripe customer id', status: 500 }

  return { ok: true, stripe_customer_id: stripeCustomerId, outcome }
}
