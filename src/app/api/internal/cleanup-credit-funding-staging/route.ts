import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredStagedCreditFundingFiles } from '@/lib/credit-funding-storage'
import { timingSafeStringEqual } from '@/lib/timing-safe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret || !timingSafeStringEqual(request.headers.get('authorization'), `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await cleanupExpiredStagedCreditFundingFiles()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Credit-funding staging cleanup failed:', error)
    return NextResponse.json({ error: 'Staging cleanup failed' }, { status: 500 })
  }
}
