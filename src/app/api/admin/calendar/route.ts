import { NextRequest, NextResponse } from 'next/server'
import { parseCalendarRange, STAFF_CALENDAR_TZ } from '@/lib/staff-calendar'
import { loadStaffCalendarBoard } from '@/lib/staff-calendar-board'
import { requireAnyStaffSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await requireAnyStaffSession()
  if (session instanceof NextResponse) return session

  const { searchParams } = new URL(request.url)
  const parsed = parseCalendarRange(searchParams.get('from'), searchParams.get('to'))
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const board = await loadStaffCalendarBoard({
      viewer: { id: session.user.id, role: session.user.role },
      range: parsed.range,
    })
    return NextResponse.json(board)
  } catch (error) {
    console.error('GET /api/admin/calendar error:', error)
    return NextResponse.json(
      { error: 'Could not load the calendar.', timezone: STAFF_CALENDAR_TZ },
      { status: 500 }
    )
  }
}
