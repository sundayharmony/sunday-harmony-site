import { NextRequest, NextResponse } from 'next/server'
import { dispatchOutreachBatch } from '@/lib/outreach/dispatch'
import { resolveOutreachStore } from '@/lib/outreach/runtime'
import { OUTREACH_CRON_BATCH_LIMIT } from '@/lib/outreach/scheduler'
import { timingSafeStringEqual } from '@/lib/timing-safe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

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

export async function GET(request: NextRequest) {
  if (!authorized(request)) return unauthorized()

  const store = resolveOutreachStore()
  const result = await dispatchOutreachBatch({
    store,
    workerId: 'cron-outreach-dispatch',
    limit: OUTREACH_CRON_BATCH_LIMIT,
  })
  return NextResponse.json({
    ok: true,
    sent: result.accepted,
    liveSend: !result.skippedDisabled,
    ...result,
  })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
