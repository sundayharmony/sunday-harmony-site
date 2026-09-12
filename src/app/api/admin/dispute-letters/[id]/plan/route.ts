import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { disputeLettersJson } from '@/lib/dispute-letters/api-client'
import { getDisputeSessionById } from '@/lib/dispute-letters/db'
import { syncLifecycleOnPlan } from '@/lib/dispute-letters/dispute-lifecycle-db'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import type { Tradeline } from '@/lib/dispute-letters/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

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

    const selectionList = Array.isArray(body?.selections) ? body.selections : []
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

    const data = (await disputeLettersJson('/internal/disputes/plan', {
      method: 'POST',
      body: JSON.stringify({ ...body, session_id: id }),
    })) as Record<string, unknown>
    return NextResponse.json({
      ...data,
      dispute_round: lifecycle.skipped
        ? null
        : { id: lifecycle.roundId, round_number: lifecycle.roundNumber },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build plan'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
