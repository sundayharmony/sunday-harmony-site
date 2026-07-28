import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { disputeLettersFetch } from '@/lib/dispute-letters/api-client'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import { updateDisputeSessionIntelligence } from '@/lib/dispute-letters/db'
import type { CreditIntelligenceReport, FundingContextPayload } from '@/lib/dispute-letters/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** Rebuild Credit Intelligence with optional funding/intake context. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      funding_context?: FundingContextPayload
    }

    const upstream = await disputeLettersFetch(`/internal/reports/${id}/intelligence`, {
      method: 'POST',
      body: JSON.stringify({
        session_id: id,
        funding_context: body.funding_context || null,
      }),
    })
    const upstreamText = await upstream.text()

    if (!upstream.ok) {
      const missingRoute = upstream.status === 404
      const message = missingRoute
        ? 'Credit Intelligence API route is missing on the dispute-letters service. Redeploy services/dispute-letters-api on Railway.'
        : upstreamText || `Request failed (${upstream.status})`
      return NextResponse.json(
        { error: message, upstream_status: upstream.status },
        { status: 502 }
      )
    }

    const data = JSON.parse(upstreamText) as {
      session_id: string
      credit_intelligence?: CreditIntelligenceReport
    }
    const intelligence = data.credit_intelligence
    if (intelligence) {
      await updateDisputeSessionIntelligence(id, intelligence)
    }
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to rebuild intelligence'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
