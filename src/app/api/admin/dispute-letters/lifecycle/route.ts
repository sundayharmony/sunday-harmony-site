import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import type {
  DisputeItemStatus,
  DisputeMailMethod,
  DisputePacketChecklist,
  DisputeRoundStatus,
} from '@/lib/dispute-letters/dispute-lifecycle'
import {
  loadDisputeLifecycleForApplication,
  releaseRoundToClient,
  updateDisputeItemStatus,
  updateRoundMailTracking,
  updateRoundStatus,
} from '@/lib/dispute-letters/dispute-lifecycle-db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET ?applicationUuid=... — load rounds + item queue for an application. */
export async function GET(request: NextRequest) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const applicationUuid = request.nextUrl.searchParams.get('applicationUuid')?.trim()
  if (!applicationUuid) {
    return NextResponse.json({ error: 'applicationUuid is required' }, { status: 400 })
  }

  const snapshot = await loadDisputeLifecycleForApplication(applicationUuid)
  return NextResponse.json(snapshot)
}

/** PATCH — update round status, mail tracking, client release, or item outcome. */
export async function PATCH(request: NextRequest) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  try {
    const body = await request.json()

    if (body?.roundId && body?.releaseToClient !== undefined) {
      const result = await releaseRoundToClient(String(body.roundId), Boolean(body.releaseToClient))
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ ok: true })
    }

    if (
      body?.roundId &&
      (body.mailMethod !== undefined ||
        body.trackingNumber !== undefined ||
        body.deliveredAt !== undefined ||
        body.mailedAt !== undefined ||
        body.packetChecklist !== undefined)
    ) {
      const result = await updateRoundMailTracking({
        roundId: String(body.roundId),
        mailMethod: (body.mailMethod ?? undefined) as DisputeMailMethod | null | undefined,
        trackingNumber: body.trackingNumber ?? undefined,
        deliveredAt: body.deliveredAt ?? undefined,
        mailedAt: body.mailedAt ?? undefined,
        packetChecklist: (body.packetChecklist ?? undefined) as DisputePacketChecklist | null | undefined,
        status: (body.status ?? undefined) as DisputeRoundStatus | null | undefined,
      })
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ ok: true, deadlineAt: result.deadlineAt })
    }

    if (body?.roundId && body?.status) {
      const result = await updateRoundStatus(
        String(body.roundId),
        body.status as DisputeRoundStatus,
        body.mailedAt ?? null
      )
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ ok: true })
    }
    if (body?.itemId && body?.status) {
      const result = await updateDisputeItemStatus(
        String(body.itemId),
        body.status as DisputeItemStatus,
        body.notes ?? null
      )
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json(
      {
        error:
          'Provide roundId+status, roundId+mail tracking fields, roundId+releaseToClient, or itemId+status',
      },
      { status: 400 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
