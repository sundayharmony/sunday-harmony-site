import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import {
  getConsultationSettings,
  listConsultationBlackouts,
  listConsultationHours,
  listUpcomingBookings,
  replaceConsultationBlackouts,
  replaceConsultationHours,
  saveConsultationSettings,
} from '@/lib/consultation-db'
import { cancelConsultationById } from '@/lib/consultation-service'
import { formatConsultationWhen, isValidTimeZone } from '@/lib/consultation-slots'
import { isGoogleCalendarConfigured } from '@/lib/google-calendar'

export const dynamic = 'force-dynamic'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

export async function GET() {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const settings = await getConsultationSettings()
  const [hours, blackouts, bookings] = await Promise.all([
    listConsultationHours(),
    listConsultationBlackouts(),
    listUpcomingBookings(),
  ])
  const timezone = settings?.timezone || 'America/New_York'
  return NextResponse.json({
    calendarConnected: isGoogleCalendarConfigured(),
    settings: settings ?? {
      timezone: 'America/New_York',
      slotMinutes: 30,
      bufferMinutes: 0,
      windowDays: 14,
      minLeadMinutes: 120,
    },
    hours,
    blackouts,
    bookings: bookings.map((booking) => ({
      id: booking.id,
      name: booking.guest_name,
      email: booking.guest_email,
      phone: booking.guest_phone,
      business: booking.business,
      note: booking.note,
      startsAt: booking.starts_at,
      whenLabel: formatConsultationWhen(new Date(booking.starts_at), timezone),
      meetLink: booking.meet_link,
    })),
  })
}

export async function PUT(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : ''
  if (!isValidTimeZone(timezone)) {
    return NextResponse.json({ error: 'Enter a valid timezone, such as America/New_York' }, { status: 400 })
  }

  const settings = {
    timezone,
    slotMinutes: clampInt(body.slotMinutes, 30, 15, 180),
    bufferMinutes: clampInt(body.bufferMinutes, 0, 0, 120),
    windowDays: clampInt(body.windowDays, 14, 1, 60),
    minLeadMinutes: clampInt(body.minLeadMinutes, 120, 0, 10080),
  }

  const hoursInput = Array.isArray(body.hours) ? body.hours : []
  const hours = hoursInput
    .map((row: { weekday?: unknown; startMinute?: unknown; endMinute?: unknown }) => ({
      weekday: clampInt(row.weekday, -1, 0, 6),
      startMinute: clampInt(row.startMinute, 0, 0, 1439),
      endMinute: clampInt(row.endMinute, 0, 1, 1440),
    }))
    .filter((row: { weekday: number; startMinute: number; endMinute: number }) => row.endMinute > row.startMinute)

  const blackoutInput: unknown[] = Array.isArray(body.blackouts) ? body.blackouts : []
  const blackouts = [
    ...new Set(blackoutInput.filter((date): date is string => typeof date === 'string' && DATE_KEY.test(date))),
  ]

  const saved = await saveConsultationSettings(settings)
  if (!saved) return NextResponse.json({ error: 'Could not save settings. Run the consultations SQL migration first.' }, { status: 500 })
  const hoursOk = await replaceConsultationHours(hours)
  const blackoutsOk = await replaceConsultationBlackouts(blackouts)
  if (!hoursOk || !blackoutsOk) {
    return NextResponse.json({ error: 'Settings saved, but hours or blackout dates did not update.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const body = await req.json().catch(() => null)
  const id = body && typeof body.id === 'string' ? body.id : ''
  if (body?.action !== 'cancel' || !id) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
  const result = await cancelConsultationById(id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
