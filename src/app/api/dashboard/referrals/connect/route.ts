import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { requireClientSession, getClientIdFromSession } from '@/lib/client-auth'
import { createConnectOnboardingLink, refreshConnectStatus } from '@/lib/referral-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await requireClientSession()
  if (session instanceof NextResponse) return session

  const clientId = getClientIdFromSession(session)
  const body = await req.json().catch(() => ({}))
  const action = body.action === 'sync' ? 'sync' : 'onboard'

  try {
    if (action === 'sync') {
      await refreshConnectStatus(clientId)
      return NextResponse.json({ ok: true })
    }
    const result = await createConnectOnboardingLink(clientId)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (error) {
    logApiRouteError(req, 'dashboard/referrals/connect', error)
    return NextResponse.json({ error: 'Unable to start payout setup.' }, { status: 500 })
  }
}
