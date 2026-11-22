import { NextRequest, NextResponse } from 'next/server'
import { sweepProspectReplies } from '@/lib/marketing-crm'
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
    return NextResponse.json({ ok: true, ...(await sweepProspectReplies()) })
  } catch (error) {
    console.error('Prospect reply sweep failed:', error)
    return NextResponse.json({ error: 'Prospect reply sweep failed' }, { status: 500 })
  }
}
