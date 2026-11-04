import { NextResponse } from 'next/server'
import { viewerFromSession } from '@/lib/credit-expert-assignment'
import { loadMarketingToday } from '@/lib/marketing-crm'
import { loadTodayQueue } from '@/lib/people-db'
import { requireAnyStaffSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireAnyStaffSession()
  if (session instanceof NextResponse) return session
  if (session.user.role === 'credit_manager') {
    const queue = await loadTodayQueue('credit_manager', new Date(), viewerFromSession(session))
    return NextResponse.json(queue)
  }
  const board = await loadMarketingToday(session.user.role)
  return NextResponse.json(board)
}
