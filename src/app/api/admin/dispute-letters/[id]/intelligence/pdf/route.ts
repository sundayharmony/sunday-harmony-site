import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import {
  creditIntelligencePdfFilename,
  renderCreditIntelligencePdf,
} from '@/lib/credit-intelligence-pdf-server'
import { resolveCreditIntelligenceForSession } from '@/lib/credit-intelligence-resolve'
import type { FundingContextPayload } from '@/lib/dispute-letters/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

async function buildPdfResponse(sessionId: string, fundingContext?: FundingContextPayload | null) {
  const resolved = await resolveCreditIntelligenceForSession({
    sessionId,
    fundingContext,
    rebuildIfMissing: true,
  })
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }

  const pdf = await renderCreditIntelligencePdf(resolved.report)
  const filename = creditIntelligencePdfFilename(resolved.report)

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

/** Download a branded Credit Intelligence PDF for a dispute session. */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    return await buildPdfResponse(id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Same as GET, optionally accepting funding_context for rebuild-if-missing. */
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
    return await buildPdfResponse(id, body.funding_context || null)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
