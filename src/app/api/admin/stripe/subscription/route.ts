import { NextRequest, NextResponse } from 'next/server'
import { getClientById, logActivity, updateClient } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { requireAdminSession } from '@/lib/stripe-admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = { clientId?: string; action?: 'cancel_at_period_end' | 'resume' | 'cancel_immediately' }

export async function POST(req: NextRequest) {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const clientId = body.clientId?.trim()
  const action = body.action
  if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  if (!action || !['cancel_at_period_end', 'resume', 'cancel_immediately'].includes(action)) {
    return NextResponse.json({ error: 'action must be cancel_at_period_end, resume, or cancel_immediately' }, { status: 400 })
  }

  const client = await getClientById(clientId)
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const subId = client.stripe_subscription_id?.trim()
  if (!subId) {
    return NextResponse.json({ error: 'Client has no Stripe subscription id' }, { status: 400 })
  }

  const stripe = getStripe()
  const actor = (session.user as { email?: string })?.email || 'admin'

  if (action === 'cancel_at_period_end') {
    await stripe.subscriptions.update(subId, { cancel_at_period_end: true })
    await logActivity({
      action: 'updated',
      entity_type: 'client',
      entity_id: clientId,
      actor_email: actor,
      details: `Set Stripe subscription ${subId} to cancel at period end for "${client.name}"`,
    })
  } else if (action === 'resume') {
    await stripe.subscriptions.update(subId, { cancel_at_period_end: false })
    await logActivity({
      action: 'updated',
      entity_type: 'client',
      entity_id: clientId,
      actor_email: actor,
      details: `Resumed Stripe subscription ${subId} (cleared cancel at period end) for "${client.name}"`,
    })
  } else {
    await stripe.subscriptions.cancel(subId)
    await updateClient(clientId, {
      stripe_subscription_id: '',
      billing_status: 'not_started',
      next_billing_date: undefined,
    })
    await logActivity({
      action: 'updated',
      entity_type: 'client',
      entity_id: clientId,
      actor_email: actor,
      details: `Canceled Stripe subscription ${subId} immediately for "${client.name}"`,
    })
    return NextResponse.json({ ok: true, subscription: null })
  }

  const refreshed = await stripe.subscriptions.retrieve(subId)

  return NextResponse.json({
    ok: true,
    subscription: {
      id: refreshed.id,
      status: refreshed.status,
      cancel_at_period_end: refreshed.cancel_at_period_end,
    },
  })
}
