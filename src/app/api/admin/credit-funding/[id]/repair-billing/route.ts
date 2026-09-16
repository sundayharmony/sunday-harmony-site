import { NextRequest, NextResponse } from 'next/server'
import {
  adminChargeCreditRepairFee,
  getRepairBillingSnapshot,
  logBillingActivity,
} from '@/lib/billing-service'
import { getCreditFundingApplicationById } from '@/lib/credit-funding-db'
import { billingModelForCreditApplication } from '@/lib/credit-repair-billing'
import { getClientById, updateClient } from '@/lib/db'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { isServiceError, withStripeHandler } from '@/lib/stripe-api-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

async function clientIdForApplication(id: string): Promise<string | { error: string; status: number }> {
  const application = await getCreditFundingApplicationById(id)
  if (!application) return { error: 'Application not found', status: 404 }
  const clientId = application.client_id?.trim()
  if (!clientId) {
    return {
      error: 'No client profile is linked to this application yet.',
      status: 400,
    }
  }
  if (billingModelForCreditApplication(application) === 'credit_repair_one_time') {
    const client = await getClientById(clientId)
    if (client && !client.stripe_subscription_id?.trim() && client.billing_model !== 'credit_repair_one_time') {
      await updateClient(clientId, { billing_model: 'credit_repair_one_time' })
    }
  }
  return clientId
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await context.params
  const clientId = await clientIdForApplication(id)
  if (typeof clientId !== 'string') {
    return NextResponse.json({ error: clientId.error }, { status: clientId.status })
  }

  const result = await withStripeHandler(() => getRepairBillingSnapshot(clientId))
  if (result instanceof NextResponse) return result
  if (isServiceError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    clientId,
    client: result.client,
    defaultFeeCents: result.defaultFeeCents,
    paymentMethods: result.paymentMethods,
    paid: result.paid,
  })
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await context.params
  const clientId = await clientIdForApplication(id)
  if (typeof clientId !== 'string') {
    return NextResponse.json({ error: clientId.error }, { status: clientId.status })
  }

  const body = await request.json().catch(() => ({}))
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
    clientId,
    client: result.client,
    message: result.message,
    invoiceId: result.invoiceId,
    hostedInvoiceUrl: result.hostedInvoiceUrl,
    status: result.status,
  })
}
