import { NextResponse } from 'next/server'
import type { Client } from '@/lib/db'
import { openProspectForBilling, readProspectBilling } from '@/lib/marketing-crm'
import { marketingActor, marketingError } from '@/lib/marketing-http'
import { requireMarketingSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

function billingClient(client: Client) {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    is_potential: client.is_potential,
    package_tier: client.package_tier,
    monthly_price: client.monthly_price,
    billing_status: client.billing_status,
    billing_model: client.billing_model ?? null,
    lead_type: client.lead_type ?? null,
    repair_fee_cents: client.repair_fee_cents ?? null,
    repair_fee_paid_at: client.repair_fee_paid_at ?? null,
    stripe_repair_invoice_id: client.stripe_repair_invoice_id ?? null,
    stripe_customer_id: client.stripe_customer_id,
    stripe_subscription_id: client.stripe_subscription_id,
    next_billing_date: client.next_billing_date ?? null,
    last_payment_at: client.last_payment_at ?? null,
  }
}

async function sessionOrForbid() {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (session.user.role !== 'admin' && session.user.role !== 'sales_closer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return session
}

export async function GET(_req: Request, { params }: Params) {
  const session = await sessionOrForbid()
  if (session instanceof NextResponse) return session
  try {
    const { id } = await params
    const result = await readProspectBilling(id, marketingActor(session))
    return NextResponse.json({
      prospectId: result.prospect.id,
      client: result.client ? billingClient(result.client) : null,
    })
  } catch (error) {
    return marketingError(error)
  }
}

export async function POST(_req: Request, { params }: Params) {
  const session = await sessionOrForbid()
  if (session instanceof NextResponse) return session
  try {
    const { id } = await params
    const result = await openProspectForBilling(id, marketingActor(session))
    return NextResponse.json({
      prospectId: result.prospect.id,
      client: billingClient(result.client),
    })
  } catch (error) {
    return marketingError(error)
  }
}
