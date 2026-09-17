import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { disputeLettersJson } from '@/lib/dispute-letters/api-client'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import {
  getDisputeSessionById,
  listDisputeSessionsForApplication,
} from '@/lib/dispute-letters/db'
import { resolveBureauScoresAcrossReports } from '@/lib/dispute-letters/bureau-score-history'
import type { ReportHealth } from '@/lib/dispute-letters/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/**
 * Single-bureau uploads only carry their own score, so the other bureaus would read
 * empty even when a previous report has them. Carry the newest score per bureau
 * across the client's reports and record which upload each one came from.
 */
async function withScoresAcrossReports(
  health: ReportHealth,
  sessionId: string
): Promise<ReportHealth> {
  try {
    const session = await getDisputeSessionById(sessionId)
    if (!session?.application_uuid) return health

    const siblings = await listDisputeSessionsForApplication(session.application_uuid)
    const sessions = siblings.some((s) => s.id === sessionId)
      ? siblings
      : [...siblings, session]

    const resolved = resolveBureauScoresAcrossReports({
      sessions,
      selectedSessionId: sessionId,
      selectedScores: health.credit_health?.scores,
    })

    return {
      ...health,
      credit_health: {
        ...health.credit_health,
        scores: resolved.scores,
        score_origins: resolved.origins,
      },
    }
  } catch (err) {
    console.error('health score merge failed:', err)
    return health
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    const data = (await disputeLettersJson(`/internal/reports/${id}/health`)) as ReportHealth
    return NextResponse.json(await withScoresAcrossReports(data, id))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load health summary'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
