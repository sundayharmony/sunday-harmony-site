import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import {
  getDisputeSessionById,
  listDisputeSessionsForApplication,
} from '@/lib/dispute-letters/db'
import { getCreditFundingApplicationById } from '@/lib/credit-funding-db'
import {
  creditRepairProgressPdfFilename,
  prepareCreditRepairProgressPdfInput,
  renderCreditRepairProgressPdf,
} from '@/lib/credit-repair-progress-pdf-server'
import type { CreditRepairCompareMode } from '@/lib/credit-repair-progress-pdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

function parseCompareMode(value: unknown): CreditRepairCompareMode {
  return value === 'previous' ? 'previous' : 'baseline'
}

function applicationDisplayName(application: {
  full_name?: string | null
  email?: string | null
} | null): string | null {
  if (!application) return null
  return application.full_name?.trim() || application.email?.trim() || null
}

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
    clientName = applicationDisplayName(application ?? null)
  }

  const prepared = prepareCreditRepairProgressPdfInput({
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

  const compareMode = parseCompareMode(request.nextUrl.searchParams.get('compareMode'))

  try {
    return await buildProgressPdfForSession(id, compareMode)
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
    return await buildProgressPdfForSession(id, parseCompareMode(body.compareMode))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate progress PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
