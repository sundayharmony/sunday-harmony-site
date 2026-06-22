import { NextRequest, NextResponse } from 'next/server'
import { getClientById, logActivity } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { applySubscriptionToClient } from '@/lib/stripe-subscription-sync'
import { getBillingStatusSnapshot } from '@/lib/billing-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

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
  await applySubscriptionToClient(clientId, subscription)
  const snapshot = await getBillingStatusSnapshot(clientId)
  if ('error' in snapshot) {
    return NextResponse.json({ error: snapshot.error }, { status: snapshot.status })
  }
  const updated = snapshot.client

  const actor = session.user.email || 'admin'
  await logActivity({
    action: 'updated',
    entity_type: 'client',
    entity_id: clientId,
    actor_email: actor,
    details: `Synced Stripe subscription ${subId} for "${client.name}"`,
  })

  return NextResponse.json({ client: updated, drift: snapshot.drift })
}
