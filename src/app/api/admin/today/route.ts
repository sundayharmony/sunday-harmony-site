import { NextResponse } from 'next/server'
import { requireStaffSession } from '@/lib/stripe-admin-auth'
import { loadTodayQueue } from '@/lib/people-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireStaffSession()
  if (session instanceof NextResponse) return session
  const role = session.user.role === 'credit_manager' ? 'credit_manager' : 'admin'
  const queue = await loadTodayQueue(role)
  return NextResponse.json(queue)
}
