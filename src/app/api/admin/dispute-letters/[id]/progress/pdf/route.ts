import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import {
  getDisputeSessionById,
  listDisputeSessionsForApplication,
} from '@/lib/dispute-letters/db'
import { getCreditFundingApplicationById } from '@/lib/credit-funding-db'
import {
  buildCreditRepairProgressPdfInput,
  parseCreditRepairCompareMode,
  type CreditRepairCompareMode,
} from '@/lib/credit-repair-progress-pdf'
import {
  creditRepairProgressPdfFilename,
  renderCreditRepairProgressPdf,
} from '@/lib/credit-repair-progress-pdf-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

async function buildProgressPdfForSession(
  sessionId: string,
  compareMode: CreditRepairCompareMode
) {
  const disputeSession = await getDisputeSessionById(sessionId)
  if (!disputeSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  let sessions = [disputeSession]
  let clientName: string | null = null

  if (disputeSession.application_uuid) {
    sessions = await listDisputeSessionsForApplication(disputeSession.application_uuid)
    if (!sessions.some((s) => s.id === sessionId)) {
      sessions = [...sessions, disputeSession]
    }
    const application = await getCreditFundingApplicationById(disputeSession.application_uuid)
    clientName = application?.full_name?.trim() || application?.email?.trim() || null
  }

  const prepared = buildCreditRepairProgressPdfInput({
    sessions,
    selectedSessionId: sessionId,
    compareMode,
    clientName,
  })
  if ('error' in prepared) {
    return NextResponse.json({ error: prepared.error }, { status: 400 })
  }

  const pdf = await renderCreditRepairProgressPdf(prepared)
  const filename = creditRepairProgressPdfFilename(prepared)

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

/** Download a client-facing credit repair before/after PDF (scores + account changes, no funding). */
export async function GET(request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    return await buildProgressPdfForSession(
      id,
      parseCreditRepairCompareMode(request.nextUrl.searchParams.get('compareMode'))
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate progress PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Same as GET; accepts compareMode in JSON body. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    const body = (await request.json().catch(() => ({}))) as { compareMode?: string }
    return await buildProgressPdfForSession(id, parseCreditRepairCompareMode(body.compareMode))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate progress PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
