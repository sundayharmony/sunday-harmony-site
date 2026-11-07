import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { disputeLettersJson } from '@/lib/dispute-letters/api-client'
import { getDisputeSessionById } from '@/lib/dispute-letters/db'
import {
  enrichPlanSelectionsWithItemStatus,
  type DisputeItemRow,
} from '@/lib/dispute-letters/dispute-lifecycle'
import {
  listItemsForCase,
  loadDisputeLifecycleForApplication,
  syncLifecycleOnPlan,
} from '@/lib/dispute-letters/dispute-lifecycle-db'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import {
  classifyMismatchKind,
  openInconsistenciesRemain,
} from '@/lib/dispute-letters/cross-bureau'
import {
  geminiBasisEnabled,
  mergeBasisIntoReasons,
  rewriteBasisWithGemini,
  type BasisFact,
} from '@/lib/dispute-letters/gemini-basis'
import { getSupabase } from '@/lib/supabase'
import type { Tradeline } from '@/lib/dispute-letters/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

type SelectionPayload = {
  id?: string
  selected?: boolean
  dispute_reason?: string
  item_status?: string
  preferred_letter_type?: string
  [key: string]: unknown
}

async function loadItemsForLifecycleRound(params: {
  applicationUuid?: string | null
  roundId?: string
}): Promise<DisputeItemRow[]> {
  if (params.applicationUuid) {
    const snapshot = await loadDisputeLifecycleForApplication(params.applicationUuid)
    return snapshot.items
  }
  if (!params.roundId) return []
  const { data: roundRow } = await getSupabase()
    .from('dispute_rounds')
    .select('case_id')
    .eq('id', params.roundId)
    .maybeSingle()
  if (!roundRow?.case_id) return []
  return listItemsForCase(String(roundRow.case_id))
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const row = await getDisputeSessionById(id)
    const reportTradelines = (row?.report_json?.tradelines || []) as Tradeline[]

    const selectionList = Array.isArray(body?.selections) ? (body.selections as SelectionPayload[]) : []
    const byId = new Map<string, { selected?: boolean; dispute_reason?: string }>()
    for (const s of selectionList) {
      if (s && typeof s.id === 'string') byId.set(s.id, s)
    }

    // Prefer full tradeline payloads from the client when provided (includes bureau toggles)
    const fromBody = Array.isArray(body?.tradelines) ? (body.tradelines as Tradeline[]) : null
    const tradelines: Tradeline[] = fromBody?.length
      ? fromBody
      : reportTradelines.map((t) => {
          const sel = byId.get(t.id)
          if (!sel) return { ...t, selected: Boolean(t.selected) }
          return {
            ...t,
            selected: sel.selected !== false,
            dispute_reason: (sel.dispute_reason || t.dispute_reason || '').trim(),
          }
        })

    const lifecycle = await syncLifecycleOnPlan({
      sessionId: id,
      applicationUuid: row?.application_uuid,
      tradelines,
      forceNewRound: Boolean(body?.force_new_round),
    })
    if (!lifecycle.ok) {
      return NextResponse.json({ error: lifecycle.error }, { status: lifecycle.status })
    }

    let enrichedSelections = selectionList
    if (!lifecycle.skipped) {
      const items = await loadItemsForLifecycleRound({
        applicationUuid: row?.application_uuid,
        roundId: lifecycle.roundId,
      })
      enrichedSelections = enrichPlanSelectionsWithItemStatus(selectionList, tradelines, items)
    }

    const roundNumber = lifecycle.roundNumber || 1
    let selectionsForPlan = enrichedSelections.length ? enrichedSelections : selectionList

    // Optional Gemini Basis rewrite (off by default). Never sends DOB/SSN/address.
    if (geminiBasisEnabled()) {
      const selectedTls = tradelines.filter((t) => t.selected !== false)
      const facts: BasisFact[] = selectedTls.map((t) => {
        const { kind, summary } = classifyMismatchKind(t)
        return {
          tradeline_id: t.id,
          creditor: t.creditor || '',
          mismatch_kind: kind,
          mismatch_summary: summary || t.mismatch_summary || '',
          status: t.status || '',
          evidence: t.payment_history || t.analysis_notes || '',
        }
      })
      const rewrite = await rewriteBasisWithGemini({ facts, allowLive: true })
      if (rewrite.usedGemini && Object.keys(rewrite.byTradelineId).length) {
        const current: Record<string, string> = {}
        for (const sel of selectionsForPlan) {
          if (sel?.id) current[sel.id] = String(sel.dispute_reason || '')
        }
        const merged = mergeBasisIntoReasons(current, rewrite.byTradelineId)
        selectionsForPlan = selectionsForPlan.map((sel) =>
          sel?.id && merged[sel.id] ? { ...sel, dispute_reason: merged[sel.id] } : sel
        )
      }
    }

    const statusMap: Record<string, string> = {}
    for (const sel of selectionsForPlan) {
      if (sel?.id && sel.item_status) statusMap[sel.id] = String(sel.item_status)
    }
    const mismatchesStillOpen =
      roundNumber >= 2 && openInconsistenciesRemain(tradelines, statusMap)

    const planBody: Record<string, unknown> = {
      ...body,
      session_id: id,
      selections: selectionsForPlan,
      round_number: roundNumber,
    }
    if (roundNumber >= 2) {
      planBody.force_one_item_per_bureau = true
    }

    const data = (await disputeLettersJson('/internal/disputes/plan', {
      method: 'POST',
      body: JSON.stringify(planBody),
    })) as Record<string, unknown>
    return NextResponse.json({
      ...data,
      round_strategy: {
        round_number: roundNumber,
        inconsistencies_still_open: mismatchesStillOpen,
        note: mismatchesStillOpen
          ? 'Round 2+ focus stays on open cross-bureau mismatches until cleared/aligned; consistent inaccuracies wait.'
          : roundNumber >= 2
            ? 'Mismatches cleared/aligned — Round 2+ may focus consistent-across-bureau inaccuracies.'
            : 'Round 1: all three bureau letters, ≤7 items each, inconsistencies first (extra items paginate into letter N of M).',
      },
      dispute_round: lifecycle.skipped
        ? null
        : { id: lifecycle.roundId, round_number: lifecycle.roundNumber },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build plan'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
