import { NextRequest, NextResponse } from 'next/server'
import { importPortalReplies } from '@/lib/portal-message-server'
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
    const result = await importPortalReplies()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Portal message replies failed:', error)
    return NextResponse.json({ error: 'Portal reply import failed' }, { status: 500 })
  }
}
