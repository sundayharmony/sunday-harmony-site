import { disputeLettersFetch } from '@/lib/dispute-letters/api-client'
import {
  getDisputeSessionById,
  updateDisputeSessionIntelligence,
} from '@/lib/dispute-letters/db'
import type {
  CreditIntelligenceReport,
  DisputeSessionListItem,
  FundingContextPayload,
} from '@/lib/dispute-letters/types'

export function intelligenceFromDisputeSession(
  session: DisputeSessionListItem
): CreditIntelligenceReport | null {
  return session.intelligence_json || session.report_json?.credit_intelligence || null
}

export async function resolveCreditIntelligenceForSession(params: {
  sessionId: string
  fundingContext?: FundingContextPayload | null
  rebuildIfMissing?: boolean
}): Promise<
  | { ok: true; report: CreditIntelligenceReport; session: DisputeSessionListItem }
  | { ok: false; error: string; status: number }
> {
  const session = await getDisputeSessionById(params.sessionId)
  if (!session) {
    return { ok: false, error: 'Dispute session not found', status: 404 }
  }

  let report = intelligenceFromDisputeSession(session)
  if (report) {
    return { ok: true, report, session }
  }

  if (params.rebuildIfMissing === false) {
    return {
      ok: false,
      error: 'Credit intelligence has not been generated for this report yet.',
      status: 400,
    }
  }

  try {
    const upstream = await disputeLettersFetch(`/internal/reports/${params.sessionId}/intelligence`, {
      method: 'POST',
      body: JSON.stringify({
        session_id: params.sessionId,
        funding_context: params.fundingContext || null,
      }),
    })
    const upstreamText = await upstream.text()
    if (!upstream.ok) {
      const missingRoute = upstream.status === 404
      return {
        ok: false,
        error: missingRoute
          ? 'Credit Intelligence API route is missing on the dispute-letters service. Redeploy services/dispute-letters-api on Railway.'
          : upstreamText || `Failed to rebuild intelligence (${upstream.status})`,
        status: 502,
      }
    }

    const data = JSON.parse(upstreamText) as {
      credit_intelligence?: CreditIntelligenceReport
    }
    report = data.credit_intelligence || null
    if (!report) {
      return {
        ok: false,
        error: 'Intelligence rebuild completed without a report payload.',
        status: 502,
      }
    }
    await updateDisputeSessionIntelligence(params.sessionId, report)
    const refreshed = (await getDisputeSessionById(params.sessionId)) || session
    return { ok: true, report, session: refreshed }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to rebuild intelligence',
      status: 502,
    }
  }
}
