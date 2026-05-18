import { NextRequest, NextResponse } from 'next/server'
import { authorizeBillingClient } from '@/lib/billing-access'
import { changeSubscriptionTier, logBillingActivity } from '@/lib/billing-service'
import type { PackageTier } from '@/lib/stripe-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIERS: PackageTier[] = ['social_essentials', 'spark', 'growth', 'scale']

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const auth = await authorizeBillingClient(typeof body.clientId === 'string' ? body.clientId : undefined)
  if (auth instanceof NextResponse) return auth

  const tier = typeof body.tier === 'string' ? body.tier.trim() : ''
  if (!TIERS.includes(tier as PackageTier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

  const result = await changeSubscriptionTier(auth.clientId, tier as PackageTier)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  await logBillingActivity(auth.clientId, auth.actorEmail, `Changed plan to ${tier}`)
  return NextResponse.json({
    subscriptionId: result.subscription.id,
    status: result.subscription.status,
  })
}
