import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getClientById, logActivity, updateClient } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { requireAdminSession } from '@/lib/stripe-admin-auth'

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
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { clientId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const clientId = body.clientId?.trim()
  if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })

  const client = await getClientById(clientId)
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const subId = client.stripe_subscription_id?.trim()
  if (!subId) {
    return NextResponse.json({ error: 'No subscription id on file to sync' }, { status: 400 })
  }

  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(subId)
  const stripeCustomerId = String(subscription.customer)
  const subscriptionPeriodEnd = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end

  const updated = await updateClient(clientId, {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: stripeCustomerId,
    billing_status: toBillingStatus(subscription.status),
    is_potential: false,
    next_billing_date: subscriptionPeriodEnd
      ? new Date(subscriptionPeriodEnd * 1000).toISOString()
      : undefined,
  })

  const actor = (session.user as { email?: string })?.email || 'admin'
  await logActivity({
    action: 'updated',
    entity_type: 'client',
    entity_id: clientId,
    actor_email: actor,
    details: `Synced Stripe subscription ${subId} for "${client.name}"`,
  })

  return NextResponse.json({ client: updated })
}
