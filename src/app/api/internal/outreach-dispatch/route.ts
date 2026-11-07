import { NextRequest, NextResponse } from 'next/server'
import { timingSafeStringEqual } from '@/lib/timing-safe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function authorized(request: NextRequest): boolean {
  const header = request.headers.get('authorization')
  const cron = process.env.CRON_SECRET?.trim()
  const secret = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return Boolean(
    (cron && timingSafeStringEqual(header, `Bearer ${cron}`)) ||
      (secret && timingSafeStringEqual(header, `Bearer ${secret}`))
  )
}

function disabled() {
  return NextResponse.json({
    ok: true,
    sent: 0,
    liveSend: false,
    skippedDisabled: true,
    details: ['automatic_dispatch_disabled'],
    note: 'Outreach sends only from Admin → Outreach → Send.',
  })
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return unauthorized()
  return disabled()
}

export async function POST(request: NextRequest) {
  return GET(request)
}
