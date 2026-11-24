import { NextRequest, NextResponse } from 'next/server'
import { runAuditSender } from '@/lib/outreach/audit-sender'
import { timingSafeStringEqual } from '@/lib/timing-safe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/** Daily free-audit email run (Vercel cron, Tue–Thu ~9:17am ET). ?dryRun=1 counts without sending. */
export async function GET(request: NextRequest) {
  const header = request.headers.get('authorization')
  const ok = [process.env.CRON_SECRET, process.env.ICP_JOB_SECRET]
    .map((s) => s?.trim())
    .some((s) => Boolean(s) && timingSafeStringEqual(header, `Bearer ${s}`))
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'
  const force = dryRun && request.nextUrl.searchParams.get('force') === '1'
  try {
    const summary = await runAuditSender({ dryRun, force, deadlineMs: 250_000 })
    return NextResponse.json(summary, { status: summary.ok || summary.reason?.startsWith('not_a_send_day') ? 200 : 503 })
  } catch (error) {
    return NextResponse.json({ ok: false, reason: error instanceof Error ? error.message : 'unknown' }, { status: 500 })
  }
}
