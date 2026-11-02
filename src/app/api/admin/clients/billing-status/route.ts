import { NextRequest, NextResponse } from 'next/server'
import { getBillingStatusSnapshot } from '@/lib/billing-service'
import { requireMarketingBillingSession } from '@/lib/billing-access'
import { isServiceError, withStripeHandler } from '@/lib/stripe-api-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const clientId = new URL(req.url).searchParams.get('clientId')?.trim() || ''
  const session = await requireMarketingBillingSession(clientId)
  if (session instanceof NextResponse) return session
  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  const result = await withStripeHandler(() => getBillingStatusSnapshot(clientId))
  if (result instanceof NextResponse) return result
  if (isServiceError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}
