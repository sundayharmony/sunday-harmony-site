import { NextRequest, NextResponse } from 'next/server'
import { viewerFromSession } from '@/lib/credit-expert-assignment'
import { loadMarketingToday } from '@/lib/marketing-crm'
import { loadTodayQueue } from '@/lib/people-db'
import { requireAnyStaffSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await requireAnyStaffSession()
  if (session instanceof NextResponse) return session
  const scope = request.nextUrl.searchParams.get('scope')
  if (scope === 'credit') {
    if (session.user.role !== 'admin' && session.user.role !== 'credit_manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const role = session.user.role === 'credit_manager' ? 'credit_manager' : 'admin'
    const queue = await loadTodayQueue(role, new Date(), viewerFromSession(session))
    return NextResponse.json({ role, applications: queue.applications })
  }
  if (session.user.role === 'credit_manager') {
    const queue = await loadTodayQueue('credit_manager', new Date(), viewerFromSession(session))
    return NextResponse.json(queue)
  }
  const board = await loadMarketingToday(session.user.role)
  return NextResponse.json(board)
}
