import { disputeLettersFetch } from '@/lib/dispute-letters/api-client'
import {
  getDisputeSessionById,
  updateDisputeSessionIntelligence,
} from '@/lib/dispute-letters/db'
import { listLifecycleItemsForSession } from '@/lib/dispute-letters/dispute-lifecycle-db'
import type { DisputeItemStatus } from '@/lib/dispute-letters/dispute-lifecycle'
import type {
  AccountOutcomePayload,
  CreditIntelligenceReport,
  DisputeSessionListItem,
  FundingContextPayload,
} from '@/lib/dispute-letters/types'

const OUTCOME_RANK: Record<AccountOutcomePayload['status'], number> = {
  no_response: 1,
  updated: 2,
  verified: 3,
  withdrawn: 4,
  deleted: 5,
}

function outcomeStatus(status: DisputeItemStatus): AccountOutcomePayload['status'] | null {
  if (status in OUTCOME_RANK) return status as AccountOutcomePayload['status']
  return null
}

/** One bureau result per creditor + last 4. A deletion wins over a later verified row. */
export function accountOutcomesFromItems(
  items: Array<{ creditor_name?: string | null; account_last4?: string | null; current_status?: DisputeItemStatus | null }>
): AccountOutcomePayload[] {
  const best = new Map<string, AccountOutcomePayload>()
  for (const item of items) {
    const status = item.current_status ? outcomeStatus(item.current_status) : null
    if (!status) continue
    const creditor = String(item.creditor_name || '').trim()
    const last4 = String(item.account_last4 || '').replace(/\D/g, '').slice(-4)
    if (!creditor && last4.length !== 4) continue
    const key = `${creditor.toLowerCase()}|${last4}`
    const next: AccountOutcomePayload = { creditor, account_last4: last4, status }
    const prev = best.get(key)
    if (!prev || OUTCOME_RANK[status] > OUTCOME_RANK[prev.status]) best.set(key, next)
  }
  return [...best.values()]
}

export async function accountOutcomesForSession(sessionId: string): Promise<AccountOutcomePayload[]> {
  try {
    const items = await listLifecycleItemsForSession(sessionId)
    return accountOutcomesFromItems(items)
  } catch {
    return []
  }
}

export function intelligenceFromDisputeSession(
  session: DisputeSessionListItem
): CreditIntelligenceReport | null {
  return session.intelligence_json || session.report_json?.credit_intelligence || null
}

/**
 * Resolve or rebuild Credit Intelligence for a dispute session.
 * Intelligence funding_readiness is advisory and must not overwrite staff FundingScores.
 */
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
    const accountOutcomes = await accountOutcomesForSession(params.sessionId)
    const upstream = await disputeLettersFetch(`/internal/reports/${params.sessionId}/intelligence`, {
      method: 'POST',
      body: JSON.stringify({
        session_id: params.sessionId,
        funding_context: params.fundingContext || null,
        account_outcomes: accountOutcomes,
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
