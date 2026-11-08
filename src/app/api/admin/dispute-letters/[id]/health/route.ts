import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { disputeLettersJson } from '@/lib/dispute-letters/api-client'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import {
  getDisputeSessionById,
  listDisputeSessionsForApplication,
} from '@/lib/dispute-letters/db'
import { resolveBureauScoresAcrossReports } from '@/lib/dispute-letters/bureau-score-history'
import { enrichTradelinesAcrossReports } from '@/lib/dispute-letters/cross-report-tradelines'
import { healthFromStoredReport } from '@/lib/dispute-letters/stored-report-health'
import type { ReportHealth } from '@/lib/dispute-letters/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 90

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

    const tradelines = enrichTradelinesAcrossReports(
      health.tradelines_by_priority || [],
      sessions,
      sessionId
    )

    return {
      ...health,
      tradelines_by_priority: tradelines,
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
    const stored = healthFromStoredReport(id, access.session.report_json)
    if (stored) {
      return NextResponse.json(await withScoresAcrossReports(stored, id))
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 85_000)
    let data: ReportHealth
    try {
      data = (await disputeLettersJson(`/internal/reports/${id}/health`, {
        signal: controller.signal,
      })) as ReportHealth
    } finally {
      clearTimeout(timer)
    }
    return NextResponse.json(await withScoresAcrossReports(data, id))
  } catch (err) {
    const aborted =
      (err instanceof Error && err.name === 'AbortError') ||
      (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError')
    const message = aborted
      ? 'Health summary timed out waiting for the analysis service. Refresh and try again.'
      : err instanceof Error
        ? err.message
        : 'Failed to load health summary'
    return NextResponse.json({ error: message }, { status: aborted ? 504 : 502 })
  }
}
