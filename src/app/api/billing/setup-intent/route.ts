import { NextRequest, NextResponse } from 'next/server'
import { authorizeBillingClient } from '@/lib/billing-access'
import { createSetupIntentForClient } from '@/lib/billing-service'
import { isServiceError, withStripeHandler } from '@/lib/stripe-api-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const auth = await authorizeBillingClient(typeof body.clientId === 'string' ? body.clientId : undefined)
  if (auth instanceof NextResponse) return auth

  const result = await withStripeHandler(() => createSetupIntentForClient(auth.clientId))
  if (result instanceof NextResponse) return result
  if (isServiceError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    clientSecret: result.clientSecret,
    stripeCustomerId: result.stripeCustomerId,
  })
}
