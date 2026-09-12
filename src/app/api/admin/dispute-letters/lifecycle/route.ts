import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import type {
  DisputeItemStatus,
  DisputeRoundStatus,
} from '@/lib/dispute-letters/dispute-lifecycle'
import {
  loadDisputeLifecycleForApplication,
  updateDisputeItemStatus,
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

/** PATCH — update round status or item outcome. */
export async function PATCH(request: NextRequest) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  try {
    const body = await request.json()
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
      { error: 'Provide roundId+status or itemId+status' },
      { status: 400 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
