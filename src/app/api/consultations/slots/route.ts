import { NextResponse } from 'next/server'
import { groupSlots, loadOpenSlots } from '@/lib/consultation-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const open = await loadOpenSlots()
    if (!open) {
      return NextResponse.json({ calendarConnected: false, timezone: 'America/New_York', days: [] })
    }
    return NextResponse.json({
      calendarConnected: open.calendarConnected,
      timezone: open.settings.timezone,
      slotMinutes: open.settings.slotMinutes,
      days: groupSlots(open.slots, open.settings.timezone),
    })
  } catch (error) {
    console.error('consultation slots failed:', error)
    return NextResponse.json({ calendarConnected: false, timezone: 'America/New_York', days: [] })
  }
}
