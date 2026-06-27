import { NextRequest, NextResponse } from 'next/server'
import { getClientById } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { normalizeStripeInvoice } from '@/lib/stripe-invoice-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')?.trim()
  const customerIdParam = searchParams.get('customerId')?.trim()
  const limitRaw = searchParams.get('limit')
  const limit = Math.min(50, Math.max(1, parseInt(limitRaw || '10', 10) || 10))

  let customerId = customerIdParam
  if (!customerId && clientId) {
    const client = await getClientById(clientId)
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    customerId = client.stripe_customer_id?.trim() || undefined
  }

  if (!customerId) {
    return NextResponse.json({ error: 'Provide clientId or customerId' }, { status: 400 })
  }

  const stripe = getStripe()
  const list = await stripe.invoices.list({ customer: customerId, limit })

  return NextResponse.json({ invoices: list.data.map(normalizeStripeInvoice) })
}
