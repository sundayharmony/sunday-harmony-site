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

    // #region agent log
    fetch('http://127.0.0.1:7413/ingest/b41535e0-0f57-49e9-94f2-079fcf155127', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '148064' },
      body: JSON.stringify({
        sessionId: '148064',
        hypothesisId: 'A',
        location: 'intelligence/route.ts:entry',
        message: 'intelligence rebuild requested',
        data: {
          sessionIdPrefix: id.slice(0, 8),
          hasFundingContext: Boolean(body.funding_context),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    const upstream = await disputeLettersFetch(`/internal/reports/${id}/intelligence`, {
      method: 'POST',
      body: JSON.stringify({
        session_id: id,
        funding_context: body.funding_context || null,
      }),
    })
    const upstreamText = await upstream.text()

    // #region agent log
    fetch('http://127.0.0.1:7413/ingest/b41535e0-0f57-49e9-94f2-079fcf155127', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '148064' },
      body: JSON.stringify({
        sessionId: '148064',
        hypothesisId: 'A',
        location: 'intelligence/route.ts:upstream',
        message: 'python intelligence upstream response',
        data: { status: upstream.status, bodyPreview: upstreamText.slice(0, 200) },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

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
      try {
        await updateDisputeSessionIntelligence(id, intelligence)
      } catch (dbErr) {
        // #region agent log
        fetch('http://127.0.0.1:7413/ingest/b41535e0-0f57-49e9-94f2-079fcf155127', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '148064' },
          body: JSON.stringify({
            sessionId: '148064',
            hypothesisId: 'C',
            location: 'intelligence/route.ts:db',
            message: 'intelligence_json persist failed',
            data: { error: dbErr instanceof Error ? dbErr.message : String(dbErr) },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
        // #endregion
      }
    }
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to rebuild intelligence'
    // #region agent log
    fetch('http://127.0.0.1:7413/ingest/b41535e0-0f57-49e9-94f2-079fcf155127', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '148064' },
      body: JSON.stringify({
        sessionId: '148064',
        hypothesisId: 'B',
        location: 'intelligence/route.ts:catch',
        message: 'intelligence rebuild exception',
        data: { error: message.slice(0, 300) },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
