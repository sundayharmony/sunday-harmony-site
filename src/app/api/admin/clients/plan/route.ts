import { NextRequest, NextResponse } from 'next/server'
import { adminUpdateClientPlan, logBillingActivity } from '@/lib/billing-service'
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

  const activateBilling = body.activateBilling !== false
  const startStripeIfReady = body.startStripeIfReady !== false

  const result = await withStripeHandler(() =>
    adminUpdateClientPlan(clientId, tier as PackageTier, {
      activateBilling,
      startStripeIfReady,
    })
  )
  if (result instanceof NextResponse) return result
  if (isServiceError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const actor = session.user.email || 'admin'
  await logBillingActivity(clientId, actor, result.message)

  return NextResponse.json({
    client: result.client,
    message: result.message,
    subscriptionId: result.subscription?.id ?? null,
    requiresClientAction: result.requiresClientAction ?? false,
  })
}
