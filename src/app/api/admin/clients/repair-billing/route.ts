import { NextRequest, NextResponse } from 'next/server'
import {
  adminChargeCreditRepairFee,
  getRepairBillingSnapshot,
  logBillingActivity,
} from '@/lib/billing-service'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { isServiceError, withStripeHandler } from '@/lib/stripe-api-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const clientId = new URL(req.url).searchParams.get('clientId')?.trim() || ''
  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  const result = await withStripeHandler(() => getRepairBillingSnapshot(clientId))
  if (result instanceof NextResponse) return result
  if (isServiceError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    client: result.client,
    defaultFeeCents: result.defaultFeeCents,
    paymentMethods: result.paymentMethods,
    invoices: result.invoices,
    paid: result.paid,
  })
}

export async function POST(req: NextRequest) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const body = await req.json().catch(() => ({}))
  const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : ''
  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  const result = await withStripeHandler(() =>
    adminChargeCreditRepairFee(clientId, {
      amount: body.amount,
      sendInvoice: Boolean(body.sendInvoice),
      description: typeof body.description === 'string' ? body.description : undefined,
    })
  )
  if (result instanceof NextResponse) return result
  if (isServiceError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  await logBillingActivity(clientId, session.user.email || 'staff', result.message)
  return NextResponse.json({
    client: result.client,
    message: result.message,
    invoiceId: result.invoiceId,
    hostedInvoiceUrl: result.hostedInvoiceUrl,
    status: result.status,
    emailed: result.emailed,
    charged: result.charged,
  })
}
