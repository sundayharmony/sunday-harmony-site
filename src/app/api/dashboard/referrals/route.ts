import { NextResponse } from 'next/server'
import { requireClientSession, getClientIdFromSession } from '@/lib/client-auth'
import { getClientReferralDashboard } from '@/lib/referral-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const session = await requireClientSession()
  if (session instanceof NextResponse) return session

  const result = await getClientReferralDashboard(getClientIdFromSession(session))
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json(result)
}
