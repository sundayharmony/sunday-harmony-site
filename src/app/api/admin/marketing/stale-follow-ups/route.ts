import { NextResponse } from 'next/server'
import { marketingActor, marketingError } from '@/lib/marketing-http'
import { clearStaleFollowUps } from '@/lib/marketing-workspace-server'
import { requireMarketingSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

/** One-click cleanup of follow-up dates more than 3 days past. Admin only. */
export async function POST() {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    return NextResponse.json(await clearStaleFollowUps(marketingActor(session)))
  } catch (error) {
    return marketingError(error)
  }
}
