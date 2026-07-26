import { NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { listDisputeSessions } from '@/lib/dispute-letters/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const email = session.user?.email
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessions = await listDisputeSessions(email)
  return NextResponse.json({ sessions })
}
