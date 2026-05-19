import { NextRequest, NextResponse } from 'next/server'
import { authorizeBillingClient } from '@/lib/billing-access'
import { createOrUpdateSubscription, logBillingActivity } from '@/lib/billing-service'
import { isFreeTier, STRIPE_BILLABLE_TIERS, type PackageTier } from '@/lib/stripe-catalog'
import { isServiceError, withStripeHandler } from '@/lib/stripe-api-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const auth = await authorizeBillingClient(typeof body.clientId === 'string' ? body.clientId : undefined)
  if (auth instanceof NextResponse) return auth
  if (!auth.isAdmin) {
    return NextResponse.json({ error: 'Only admins can start subscriptions.' }, { status: 403 })
  }

  const tier = typeof body.tier === 'string' ? body.tier.trim() : ''
  const paymentMethodId = typeof body.paymentMethodId === 'string' ? body.paymentMethodId.trim() : ''

  if (isFreeTier(tier)) {
    return NextResponse.json(
      { error: 'Free tier cannot be purchased. Ask your admin or switch plans in billing.' },
      { status: 400 }
    )
  }
  if (!STRIPE_BILLABLE_TIERS.includes(tier as (typeof STRIPE_BILLABLE_TIERS)[number])) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }
  if (!paymentMethodId) {
    return NextResponse.json({ error: 'paymentMethodId is required' }, { status: 400 })
  }

  const result = await withStripeHandler(() =>
    createOrUpdateSubscription(auth.clientId, tier as PackageTier, paymentMethodId)
  )
  if (result instanceof NextResponse) return result

  if ('requiresAction' in result) {
    return NextResponse.json(
      {
        requiresAction: true,
        clientSecret: result.clientSecret,
        error: 'Additional authentication is required to complete payment.',
      },
      { status: 402 }
    )
  }
  if (isServiceError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  await logBillingActivity(
    auth.clientId,
    auth.actorEmail,
    `Started/updated subscription (${tier}) via embedded billing`
  )

  return NextResponse.json({
    subscriptionId: result.subscription.id,
    status: result.subscription.status,
    cancelAtPeriodEnd: result.subscription.cancel_at_period_end,
  })
}
