import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getClientIdFromSession, requireClientSession } from '@/lib/client-auth'
import { getClientById } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { normalizeStripeInvoice } from '@/lib/stripe-invoice-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireClientSession()
  if (session instanceof NextResponse) return session
  const clientId = getClientIdFromSession(session)

  const client = await getClientById(clientId)
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const customerId = client.stripe_customer_id?.trim()
  if (!customerId) {
    return NextResponse.json({ invoices: [], message: 'Billing is not connected to Stripe yet.' })
  }

  const stripe = getStripe()
  const list = await stripe.invoices.list({ customer: customerId, limit: 24 })

  return NextResponse.json({ invoices: list.data.map(normalizeStripeInvoice) })
}
