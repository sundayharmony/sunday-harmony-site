import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import { failDisputeSessionIfStillAnalyzing, getDisputeSessionById } from '@/lib/dispute-letters/db'
import { isStaleAnalysis, STALE_ANALYSIS_MESSAGE, STALE_ANALYSIS_MS } from '@/lib/dispute-letters/analysis-liveness'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** Poll Supabase session status while background analysis runs on Render. */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  const row = await getDisputeSessionById(id)
  if (!row) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (isStaleAnalysis(row.status, row.updated_at)) {
    const staleBefore = new Date(Date.now() - STALE_ANALYSIS_MS).toISOString()
    const marked = await failDisputeSessionIfStillAnalyzing(id, STALE_ANALYSIS_MESSAGE, staleBefore)
    if (marked) {
      return NextResponse.json({
        session_id: id,
        status: 'failed',
        error_message: STALE_ANALYSIS_MESSAGE,
      })
    }
    const latest = await getDisputeSessionById(id)
    if (!latest || isStaleAnalysis(latest.status, latest.updated_at)) {
      return NextResponse.json({
        session_id: id,
        status: 'failed',
        error_message: STALE_ANALYSIS_MESSAGE,
      })
    }
    return NextResponse.json({
      session_id: id,
      status: latest.status,
      error_message: latest.error_message ?? null,
    })
  }

  return NextResponse.json({
    session_id: id,
    status: row.status,
    error_message: row.error_message ?? null,
  })
}
