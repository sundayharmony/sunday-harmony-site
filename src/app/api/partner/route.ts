import { NextResponse } from 'next/server'
import { requirePartnerSession } from '@/lib/partner-auth'
import { getPartnerDashboard } from '@/lib/partner-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const session = await requirePartnerSession()
  if (session instanceof NextResponse) return session
  const result = await getPartnerDashboard(session.user.id)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json(result)
}
