import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import {
  backfillHistoricalRound1ForApplication,
  findApplicationUuidByConsumerName,
} from '@/lib/dispute-letters/dispute-lifecycle-db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** POST — record a mailed Round 1 from the original 3-bureau report and later bureau PDFs as responses. */
export async function POST(request: NextRequest) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  try {
    const body = await request.json().catch(() => ({}))
    let applicationUuid = String(body?.applicationUuid || '').trim()
    const consumerName = String(body?.consumerName || '').trim()
    const preferredReportDate = String(body?.preferredReportDate || '').trim() || undefined

    if (!applicationUuid && consumerName) {
      applicationUuid = (await findApplicationUuidByConsumerName(consumerName)) || ''
    }
    if (!applicationUuid) {
      return NextResponse.json({ error: 'applicationUuid or consumerName is required' }, { status: 400 })
    }

    const result = await backfillHistoricalRound1ForApplication({
      applicationUuid,
      preferredReportDate,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true, ...result.summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Backfill failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
