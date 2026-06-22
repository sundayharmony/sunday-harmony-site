import { NextRequest, NextResponse } from 'next/server'
import { authorizeBillingClient } from '@/lib/billing-access'
import { logBillingActivity, savePaymentMethodForClient } from '@/lib/billing-service'
import { isServiceError, withStripeHandler } from '@/lib/stripe-api-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const auth = await authorizeBillingClient(typeof body.clientId === 'string' ? body.clientId : undefined)
  if (auth instanceof NextResponse) return auth
  if (auth.isAdmin) {
    return NextResponse.json({ error: 'Only clients can save cards from the dashboard.' }, { status: 403 })
  }

  const paymentMethodId = typeof body.paymentMethodId === 'string' ? body.paymentMethodId.trim() : ''
  if (!paymentMethodId) {
    return NextResponse.json({ error: 'paymentMethodId is required' }, { status: 400 })
  }

  const result = await withStripeHandler(() =>
    savePaymentMethodForClient(auth.clientId, paymentMethodId)
  )
  if (result instanceof NextResponse) return result
  if (isServiceError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  await logBillingActivity(auth.clientId, auth.actorEmail, 'Saved payment method for future billing')
  return NextResponse.json({ ok: true })
}
