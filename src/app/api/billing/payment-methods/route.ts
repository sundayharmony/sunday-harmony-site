import { NextRequest, NextResponse } from 'next/server'
import { authorizeBillingClient } from '@/lib/billing-access'
import {
  detachPaymentMethod,
  listPaymentMethods,
  setDefaultPaymentMethod,
  logBillingActivity,
} from '@/lib/billing-service'
import { isServiceError, withStripeHandler } from '@/lib/stripe-api-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const clientId = new URL(req.url).searchParams.get('clientId')?.trim() || undefined
  const auth = await authorizeBillingClient(clientId)
  if (auth instanceof NextResponse) return auth

  const result = await withStripeHandler(() => listPaymentMethods(auth.clientId))
  if (result instanceof NextResponse) return result
  if (isServiceError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ paymentMethods: result.paymentMethods })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const auth = await authorizeBillingClient(typeof body.clientId === 'string' ? body.clientId : undefined)
  if (auth instanceof NextResponse) return auth

  const paymentMethodId = typeof body.paymentMethodId === 'string' ? body.paymentMethodId.trim() : ''
  if (!paymentMethodId) {
    return NextResponse.json({ error: 'paymentMethodId is required' }, { status: 400 })
  }

  const result = await withStripeHandler(() =>
    setDefaultPaymentMethod(auth.clientId, paymentMethodId)
  )
  if (result instanceof NextResponse) return result
  if (isServiceError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  await logBillingActivity(auth.clientId, auth.actorEmail, 'Set default payment method')
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const auth = await authorizeBillingClient(typeof body.clientId === 'string' ? body.clientId : undefined)
  if (auth instanceof NextResponse) return auth

  const paymentMethodId = typeof body.paymentMethodId === 'string' ? body.paymentMethodId.trim() : ''
  if (!paymentMethodId) {
    return NextResponse.json({ error: 'paymentMethodId is required' }, { status: 400 })
  }

  const result = await withStripeHandler(() =>
    detachPaymentMethod(auth.clientId, paymentMethodId)
  )
  if (result instanceof NextResponse) return result
  if (isServiceError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  await logBillingActivity(auth.clientId, auth.actorEmail, 'Removed payment method')
  return NextResponse.json({ ok: true })
}
