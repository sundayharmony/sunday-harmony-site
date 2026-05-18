import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { logApiRouteError } from '@/lib/api-route-log'
import {
  getClientById,
  getClientByStripeCustomerId,
  getClientByStripeSubscriptionId,
  isStripeWebhookEventRecorded,
  recordStripeWebhookEvent,
  updateClient,
} from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { applySubscriptionToClient } from '@/lib/stripe-subscription-sync'
import { toBillingStatus } from '@/lib/stripe-billing-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handleSubscriptionEvent(subscription: Stripe.Subscription): Promise<void> {
  const stripeSubscriptionId = subscription.id
  const stripeCustomerId = String(subscription.customer)
  const client =
    (await getClientByStripeSubscriptionId(stripeSubscriptionId)) ||
    (await getClientByStripeCustomerId(stripeCustomerId)) ||
    (subscription.metadata?.client_id
      ? await getClientById(subscription.metadata.client_id)
      : undefined)

  if (client) {
    await applySubscriptionToClient(client.id, subscription)
  }
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const payload = await req.text()
    event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (err) {
    logApiRouteError(req, 'stripe webhook signature', err)
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  if (await isStripeWebhookEventRecorded(event.id)) {
    return NextResponse.json({ received: true })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const checkoutSession = event.data.object as Stripe.Checkout.Session
      if (checkoutSession.mode === 'subscription') {
        const clientIdMeta = checkoutSession.metadata?.client_id || checkoutSession.client_reference_id
        const subRaw = checkoutSession.subscription
        const subscriptionId = typeof subRaw === 'string' ? subRaw : subRaw?.id

        if (subscriptionId) {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
          let client =
            (clientIdMeta ? await getClientById(clientIdMeta) : undefined) ||
            (await getClientByStripeCustomerId(String(subscription.customer)))

          if (client) {
            await applySubscriptionToClient(client.id, subscription)
          }
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const client = await getClientByStripeSubscriptionId(subscription.id)
      if (client) {
        await updateClient(client.id, {
          stripe_subscription_id: '',
          billing_status: 'not_started',
          next_billing_date: undefined,
        })
      }
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      await handleSubscriptionEvent(event.data.object as Stripe.Subscription)
    }

    if (event.type === 'setup_intent.succeeded') {
      const setupIntent = event.data.object as Stripe.SetupIntent
      const clientId = setupIntent.metadata?.client_id
      if (clientId && setupIntent.customer) {
        await updateClient(clientId, {
          stripe_customer_id: String(setupIntent.customer),
        })
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice
      const stripeCustomerId = String(invoice.customer || '')
      const client = stripeCustomerId ? await getClientByStripeCustomerId(stripeCustomerId) : undefined
      if (client) {
        const paidAtRaw = invoice.status_transitions?.paid_at
        const paidAtSec = typeof paidAtRaw === 'number' && !Number.isNaN(paidAtRaw) ? paidAtRaw : null
        await updateClient(client.id, {
          billing_status: 'paid',
          is_potential: false,
          last_payment_at: paidAtSec ? new Date(paidAtSec * 1000).toISOString() : new Date().toISOString(),
        })
      }
    }

    if (event.type === 'invoice.payment_failed' || event.type === 'invoice.payment_action_required') {
      const invoice = event.data.object as Stripe.Invoice
      const stripeCustomerId = String(invoice.customer || '')
      const client = stripeCustomerId ? await getClientByStripeCustomerId(stripeCustomerId) : undefined
      if (client) {
        await updateClient(client.id, {
          billing_status:
            event.type === 'invoice.payment_action_required' ? 'unpaid' : 'past_due',
        })
      }
    }

    if (event.type === 'customer.subscription.trial_will_end') {
      const subscription = event.data.object as Stripe.Subscription
      const client = await getClientByStripeSubscriptionId(subscription.id)
      if (client && subscription.status === 'trialing') {
        await updateClient(client.id, { billing_status: 'trial' })
      }
    }
  } catch (err) {
    logApiRouteError(req, 'stripe webhook handler', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  await recordStripeWebhookEvent(event.id)
  return NextResponse.json({ received: true })
}
