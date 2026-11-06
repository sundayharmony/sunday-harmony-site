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

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret || !timingSafeStringEqual(request.headers.get('authorization'), `Bearer ${cronSecret}`)) {
    return unauthorized()
  }

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
