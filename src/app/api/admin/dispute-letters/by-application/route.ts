import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { listDisputeSessionsForApplication } from '@/lib/dispute-letters/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/admin/dispute-letters?applicationUuid=... — sessions linked to a funding app */
export async function GET(request: NextRequest) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const applicationUuid = request.nextUrl.searchParams.get('applicationUuid')?.trim()
  if (!applicationUuid) {
    return NextResponse.json({ error: 'applicationUuid is required' }, { status: 400 })
  }

  const sessions = await listDisputeSessionsForApplication(applicationUuid)
  return NextResponse.json({ sessions })
}
