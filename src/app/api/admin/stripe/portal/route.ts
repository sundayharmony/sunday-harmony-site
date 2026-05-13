import { NextRequest, NextResponse } from 'next/server'
import { getClientById, logActivity } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { getSiteBaseUrl } from '@/lib/stripe-catalog'

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

  const customerId = client.stripe_customer_id?.trim()
  if (!customerId) {
    return NextResponse.json({ error: 'Client has no Stripe customer. Create one first.' }, { status: 400 })
  }

  const stripe = getStripe()
  const base = getSiteBaseUrl()
  const actor = session.user.email || 'admin'

  const portalConfig = process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim()

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${base}/admin/clients?clientId=${encodeURIComponent(clientId)}`,
    ...(portalConfig ? { configuration: portalConfig } : {}),
  })

  await logActivity({
    action: 'updated',
    entity_type: 'client',
    entity_id: clientId,
    actor_email: actor,
    details: `Opened Stripe billing portal for "${client.name}"`,
  })

  return NextResponse.json({ url: portalSession.url })
}
