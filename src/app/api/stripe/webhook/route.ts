import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import {
  getClientById,
  getClientByStripeCustomerId,
  getClientByStripeSubscriptionId,
  updateClient,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function toBillingStatus(status: Stripe.Subscription.Status): 'trial' | 'paid' | 'past_due' | 'unpaid' | 'not_started' {
  if (status === 'trialing') return 'trial'
  if (status === 'active') return 'paid'
  if (status === 'past_due') return 'past_due'
  if (status === 'unpaid' || status === 'incomplete' || status === 'incomplete_expired') return 'unpaid'
  return 'not_started'
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
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const checkoutSession = event.data.object as Stripe.Checkout.Session
      if (checkoutSession.mode === 'subscription') {
        const clientIdMeta = checkoutSession.metadata?.client_id || checkoutSession.client_reference_id
        const customerRaw = checkoutSession.customer
        const customerId = typeof customerRaw === 'string' ? customerRaw : customerRaw?.id
        const subRaw = checkoutSession.subscription
        const subscriptionId = typeof subRaw === 'string' ? subRaw : subRaw?.id

        if (subscriptionId && customerId) {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
          const stripeSubscriptionId = subscription.id
          const stripeCustomerId = String(subscription.customer)
          const subscriptionPeriodEnd = (subscription as Stripe.Subscription & { current_period_end?: number })
            .current_period_end

          let client =
            (clientIdMeta ? await getClientById(clientIdMeta) : undefined) ||
            (await getClientByStripeCustomerId(stripeCustomerId))

          if (client) {
            await updateClient(client.id, {
              stripe_subscription_id: stripeSubscriptionId,
              stripe_customer_id: stripeCustomerId,
              billing_status: toBillingStatus(subscription.status),
              is_potential: false,
              next_billing_date: subscriptionPeriodEnd
                ? new Date(subscriptionPeriodEnd * 1000).toISOString()
                : undefined,
            })
          }
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const stripeSubscriptionId = subscription.id
      const client = await getClientByStripeSubscriptionId(stripeSubscriptionId)
      if (client) {
        await updateClient(client.id, {
          stripe_subscription_id: '',
          billing_status: 'not_started',
          next_billing_date: undefined,
        })
      }
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription
      const stripeSubscriptionId = subscription.id
      const stripeCustomerId = String(subscription.customer)
      const subscriptionPeriodEnd = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end
      const client =
        await getClientByStripeSubscriptionId(stripeSubscriptionId) ||
        await getClientByStripeCustomerId(stripeCustomerId)

      if (client) {
        await updateClient(client.id, {
          stripe_subscription_id: stripeSubscriptionId,
          stripe_customer_id: stripeCustomerId,
          billing_status: toBillingStatus(subscription.status),
          is_potential: false,
          next_billing_date: subscriptionPeriodEnd
            ? new Date(subscriptionPeriodEnd * 1000).toISOString()
            : undefined,
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

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice
      const stripeCustomerId = String(invoice.customer || '')
      const client = stripeCustomerId ? await getClientByStripeCustomerId(stripeCustomerId) : undefined
      if (client) {
        await updateClient(client.id, {
          billing_status: 'past_due',
        })
      }
    }
  } catch (err) {
    console.error('Stripe webhook handling error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
