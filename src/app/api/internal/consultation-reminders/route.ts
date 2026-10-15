import { NextRequest, NextResponse } from 'next/server'
import { sendDueConsultationReminders } from '@/lib/consultation-service'
import { timingSafeStringEqual } from '@/lib/timing-safe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret || !timingSafeStringEqual(request.headers.get('authorization'), `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendDueConsultationReminders()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Consultation reminders failed:', error)
    return NextResponse.json({ error: 'Reminder send failed' }, { status: 500 })
  }
}
