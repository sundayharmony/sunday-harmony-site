import { NextRequest, NextResponse } from 'next/server'
import { getClientById, logActivity } from '@/lib/db'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { ensureStripeCustomerForClient } from '@/lib/stripe-customer-utils'

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

  const actor = session.user.email || 'admin'

  const result = await ensureStripeCustomerForClient(clientId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const updated = await getClientById(clientId)
  if (!updated) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  if (result.outcome !== 'existing') {
    await logActivity({
      action: 'updated',
      entity_type: 'client',
      entity_id: clientId,
      actor_email: actor,
      details: `${result.outcome === 'linked' ? 'Linked' : 'Created'} Stripe customer ${result.stripe_customer_id} for "${client.name}"`,
    })
  }

  return NextResponse.json({
    stripe_customer_id: result.stripe_customer_id,
    outcome: result.outcome,
    client: updated,
  })
}
