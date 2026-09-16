import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import type {
  DisputeItemStatus,
  DisputeMailMethod,
  DisputePacketChecklist,
  DisputeRoundStatus,
} from '@/lib/dispute-letters/dispute-lifecycle'
import {
  confirmAllLettersSentForSession,
  confirmLetterPackageSent,
  loadDisputeLifecycleForApplication,
  loadLetterPackageForSession,
  markLetterSent,
  releaseRoundToClient,
  updateDisputeItemStatus,
  updateRoundMailTracking,
  updateRoundStatus,
} from '@/lib/dispute-letters/dispute-lifecycle-db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET ?applicationUuid=... or ?sessionId=... — load rounds, packages, and item queues. */
export async function GET(request: NextRequest) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const applicationUuid = request.nextUrl.searchParams.get('applicationUuid')?.trim()
  const sessionId = request.nextUrl.searchParams.get('sessionId')?.trim()
  if (sessionId && !applicationUuid) {
    const snapshot = await loadLetterPackageForSession(sessionId)
    return NextResponse.json(snapshot)
  }
  if (!applicationUuid) {
    return NextResponse.json({ error: 'applicationUuid or sessionId is required' }, { status: 400 })
  }

  const snapshot = await loadDisputeLifecycleForApplication(applicationUuid)
  return NextResponse.json(snapshot)
}

/** PATCH — confirm package sent, round status, mail tracking, client release, or item outcome. */
export async function PATCH(request: NextRequest) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  try {
    const body = await request.json()

    if (body?.packageId && (body.confirmSent === true || body.confirmAllSent === true)) {
      const result = await confirmLetterPackageSent(String(body.packageId))
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({
        ok: true,
        sentAt: result.sentAt,
        roundComplete: result.roundComplete,
        itemCount: result.itemCount,
      })
    }

    if (body?.sessionId && (body.confirmSent === true || body.confirmAllSent === true)) {
      const result = await confirmAllLettersSentForSession(String(body.sessionId))
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({
        ok: true,
        sentAt: result.sentAt,
        roundComplete: result.roundComplete,
        itemCount: result.itemCount,
      })
    }

    if (body?.letterId && (body.sent === true || body.markSent === true || body.status === 'sent')) {
      const result = await markLetterSent(String(body.letterId))
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({
        ok: true,
        sentAt: result.sentAt,
        roundComplete: result.roundComplete,
      })
    }

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
          'Provide packageId+confirmSent, sessionId+confirmAllSent, letterId+sent, roundId+status, roundId+mail tracking fields, roundId+releaseToClient, or itemId+status',
      },
      { status: 400 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
