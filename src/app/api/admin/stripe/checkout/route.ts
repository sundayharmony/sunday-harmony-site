import { NextRequest, NextResponse } from 'next/server'
import { getClientById, logActivity } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { ensureStripeCustomerForClient } from '@/lib/stripe-customer-utils'
import { getSiteBaseUrl, getStripePriceIdForTier } from '@/lib/stripe-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  let body: { clientId?: string; tier?: string; allowPotential?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const clientId = body.clientId?.trim()
  if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })

  const client = await getClientById(clientId)
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  if (client.is_potential && !body.allowPotential) {
    return NextResponse.json(
      { error: 'Activate billing for this client before starting a subscription checkout.' },
      { status: 400 }
    )
  }

  const tier = (body.tier || client.package_tier || 'spark').trim()
  const priceId = getStripePriceIdForTier(tier)
  if (!priceId) {
    return NextResponse.json(
      { error: `Missing STRIPE_PRICE env for tier "${tier}". Add it in .env / Vercel.` },
      { status: 500 }
    )
  }

  const ensured = await ensureStripeCustomerForClient(clientId)
  if (!ensured.ok) {
    return NextResponse.json({ error: ensured.error }, { status: ensured.status })
  }

  const stripe = getStripe()
  const base = getSiteBaseUrl()
  const actor = session.user.email || 'admin'

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: ensured.stripe_customer_id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/admin/clients?stripe=success&clientId=${encodeURIComponent(clientId)}`,
    cancel_url: `${base}/admin/clients?stripe=cancel&clientId=${encodeURIComponent(clientId)}`,
    metadata: { client_id: client.id },
    client_reference_id: client.id,
    subscription_data: {
      metadata: { client_id: client.id },
    },
  })

  const url = checkoutSession.url
  if (!url) {
    return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 500 })
  }

  await logActivity({
    action: 'updated',
    entity_type: 'client',
    entity_id: clientId,
    actor_email: actor,
    details: `Started Stripe Checkout (subscription) for "${client.name}" (${tier})`,
  })

  return NextResponse.json({ url, session_id: checkoutSession.id })
}
