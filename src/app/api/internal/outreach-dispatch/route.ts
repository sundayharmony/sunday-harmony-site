import { NextRequest, NextResponse } from 'next/server'
import { dispatchOutreachBatch } from '@/lib/outreach/dispatch'
import { createDisabledProvider } from '@/lib/outreach/provider'
import { resolveOutreachStore } from '@/lib/outreach/runtime'
import { timingSafeStringEqual } from '@/lib/timing-safe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

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
    provider: createDisabledProvider(),
    workerId: 'cron-outreach-dispatch',
  })
  return NextResponse.json({
    ok: true,
    sent: 0,
    liveSend: false,
    ...result,
  })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
