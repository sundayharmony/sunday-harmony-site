import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getClientById } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { requireAdminSession } from '@/lib/stripe-admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeInvoice(inv: Stripe.Invoice) {
  const paidAt = inv.status_transitions?.paid_at
  const paidAtMs =
    typeof paidAt === 'number' && !Number.isNaN(paidAt) ? paidAt * 1000 : null

  return {
    id: inv.id,
    number: inv.number,
    status: inv.status,
    amount_paid: inv.amount_paid,
    amount_due: inv.amount_due,
    currency: inv.currency,
    hosted_invoice_url: inv.hosted_invoice_url,
    invoice_pdf: inv.invoice_pdf,
    created: inv.created,
    period_start: inv.period_start,
    period_end: inv.period_end,
    paid_at: paidAtMs ? new Date(paidAtMs).toISOString() : null,
  }
}

export async function GET(req: NextRequest) {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  return NextResponse.json({ invoices: list.data.map(normalizeInvoice) })
}
