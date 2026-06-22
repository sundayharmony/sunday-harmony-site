import { NextRequest, NextResponse } from 'next/server'
import { getBillingStatusSnapshot } from '@/lib/billing-service'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { isServiceError, withStripeHandler } from '@/lib/stripe-api-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const clientId = new URL(req.url).searchParams.get('clientId')?.trim() || ''
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
