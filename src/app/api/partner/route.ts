import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { requirePartnerSession } from '@/lib/partner-auth'
import { getPartnerDashboard } from '@/lib/partner-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await requirePartnerSession()
  if (session instanceof NextResponse) return session
  try {
    const result = await getPartnerDashboard(session.user.id)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (error) {
    logApiRouteError(req, 'partner', error)
    return NextResponse.json({ error: 'Unable to load your partner dashboard.' }, { status: 500 })
  }
}
