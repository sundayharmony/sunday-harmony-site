import { NextRequest, NextResponse } from 'next/server'
import { authorizeBillingClient } from '@/lib/billing-access'
import { changeSubscriptionTier, logBillingActivity } from '@/lib/billing-service'
import { PACKAGE_TIERS, type PackageTier } from '@/lib/stripe-catalog'
import { isServiceError, withStripeHandler } from '@/lib/stripe-api-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const auth = await authorizeBillingClient(typeof body.clientId === 'string' ? body.clientId : undefined)
  if (auth instanceof NextResponse) return auth
  if (!auth.isAdmin) {
    return NextResponse.json({ error: 'Only admins can change plans.' }, { status: 403 })
  }

  const tier = typeof body.tier === 'string' ? body.tier.trim() : ''
  if (!PACKAGE_TIERS.includes(tier as PackageTier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

  const result = await withStripeHandler(() =>
    changeSubscriptionTier(auth.clientId, tier as PackageTier)
  )
  if (result instanceof NextResponse) return result
  if (isServiceError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  await logBillingActivity(auth.clientId, auth.actorEmail, `Changed plan to ${tier}`)
  if (result.subscription === null) {
    return NextResponse.json({ ok: true, free: true, subscription: null })
  }

  return NextResponse.json({
    subscriptionId: result.subscription.id,
    status: result.subscription.status,
    cancelAtPeriodEnd: result.subscription.cancel_at_period_end,
  })
}
