import { NextRequest, NextResponse } from 'next/server'
import { adminStartSubscription, logBillingActivity } from '@/lib/billing-service'
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
  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  const tierRaw = typeof body.tier === 'string' ? body.tier.trim() : ''
  const tier =
    tierRaw && PACKAGE_TIERS.includes(tierRaw as PackageTier)
      ? (tierRaw as PackageTier)
      : undefined

  const result = await withStripeHandler(() => adminStartSubscription(clientId, tier))
  if (result instanceof NextResponse) return result
  if (isServiceError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  await logBillingActivity(clientId, session.user.email || 'admin', result.message)
  return NextResponse.json({
    client: result.client,
    message: result.message,
    requiresClientAction: result.requiresClientAction ?? false,
  })
}
