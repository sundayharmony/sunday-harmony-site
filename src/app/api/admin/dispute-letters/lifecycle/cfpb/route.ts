import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { getCreditFundingApplicationById } from '@/lib/credit-funding-db'
import {
  buildCfpbComplaintDraft,
  type DisputeCfpbStatus,
} from '@/lib/dispute-letters/dispute-lifecycle'
import {
  listCfpbEscalationsForCase,
  loadDisputeLifecycleForApplication,
  upsertCfpbEscalation,
} from '@/lib/dispute-letters/dispute-lifecycle-db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CFPB_STATUSES = new Set<DisputeCfpbStatus>([
  'draft',
  'submitted',
  'agency_response',
  'closed',
])

/** GET ?applicationUuid= — load CFPB escalations for the application's dispute case. */
export async function GET(request: NextRequest) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const applicationUuid = request.nextUrl.searchParams.get('applicationUuid')?.trim()
  if (!applicationUuid) {
    return NextResponse.json({ error: 'applicationUuid is required' }, { status: 400 })
  }

  const snapshot = await loadDisputeLifecycleForApplication(applicationUuid)
  if (!snapshot.case) {
    return NextResponse.json({ escalations: [], case: null })
  }

  const escalations = await listCfpbEscalationsForCase(snapshot.case.id)
  return NextResponse.json({ escalations, case: snapshot.case, items: snapshot.items })
}

/** POST JSON — create/update a CFPB complaint draft from unresolved items. */
export async function POST(request: NextRequest) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  try {
    const body = await request.json()
    const applicationUuid = String(body?.applicationUuid || '').trim()
    if (!applicationUuid) {
      return NextResponse.json({ error: 'applicationUuid is required' }, { status: 400 })
    }

    const itemIds = Array.isArray(body?.itemIds)
      ? body.itemIds.map((id: unknown) => String(id)).filter(Boolean)
      : []
    if (!itemIds.length) {
      return NextResponse.json({ error: 'itemIds are required' }, { status: 400 })
    }

    const snapshot = await loadDisputeLifecycleForApplication(applicationUuid)
    if (!snapshot.case) {
      return NextResponse.json({ error: 'No dispute case for this application' }, { status: 404 })
    }

    const selectedItems = snapshot.items.filter((item) => itemIds.includes(item.id))
    if (!selectedItems.length) {
      return NextResponse.json({ error: 'No matching dispute items found' }, { status: 400 })
    }

    let complaintMarkdown =
      typeof body?.complaintMarkdown === 'string' ? body.complaintMarkdown.trim() : ''
    if (!complaintMarkdown) {
      const application = await getCreditFundingApplicationById(applicationUuid)
      const consumerName = application?.full_name?.trim() || 'Consumer'
      complaintMarkdown = buildCfpbComplaintDraft({
        consumerName,
        items: selectedItems.map((item) => ({
          creditorName: item.creditor_name,
          accountLast4: item.account_last4,
          bureau: item.bureau,
          currentStatus: item.current_status,
          notes: item.notes,
        })),
        roundSummary:
          snapshot.activeRound != null
            ? `Active / latest round: Round ${snapshot.activeRound.round_number} (${snapshot.activeRound.status}).`
            : undefined,
      })
    }

    const statusRaw = String(body?.status || 'draft').trim() as DisputeCfpbStatus
    const status = CFPB_STATUSES.has(statusRaw) ? statusRaw : 'draft'
    const notes =
      typeof body?.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
    const id = typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : undefined

    const result = await upsertCfpbEscalation({
      id,
      caseId: snapshot.case.id,
      itemIds,
      complaintMarkdown,
      status,
      notes,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true, escalation: result.row })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'CFPB draft failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
