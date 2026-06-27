import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClientById } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { normalizeStripeInvoice } from '@/lib/stripe-invoice-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as { role?: string; clientId?: string }
  if (user.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = user.clientId
  if (!clientId) {
    return NextResponse.json({ error: 'No client profile linked' }, { status: 404 })
  }

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
