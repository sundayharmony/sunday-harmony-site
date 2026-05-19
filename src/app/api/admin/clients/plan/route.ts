import { NextRequest, NextResponse } from 'next/server'
import { adminSetClientPlan, changeSubscriptionTier, logBillingActivity } from '@/lib/billing-service'
import { PACKAGE_TIERS, type PackageTier } from '@/lib/stripe-catalog'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { isServiceError, withStripeHandler } from '@/lib/stripe-api-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const body = await req.json().catch(() => ({}))
  const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : ''
  const tier = typeof body.tier === 'string' ? body.tier.trim() : ''

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }
  if (!PACKAGE_TIERS.includes(tier as PackageTier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

  const hasSubscription = Boolean(
    typeof body.hasSubscription === 'boolean' ? body.hasSubscription : false
  )

  const result = await withStripeHandler(async () => {
    if (hasSubscription) {
      return changeSubscriptionTier(clientId, tier as PackageTier, { skipPotentialCheck: true })
    }
    return adminSetClientPlan(clientId, tier as PackageTier)
  })
  if (result instanceof NextResponse) return result
  if (isServiceError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const actor = session.user.email || 'admin'
  const message =
    'subscription' in result
      ? `Changed active subscription plan to ${tier}`
      : result.message
  await logBillingActivity(clientId, actor, message)

  return NextResponse.json({
    client: 'client' in result ? result.client : null,
    message,
    subscriptionId: 'subscription' in result ? (result.subscription?.id ?? null) : null,
  })
}
