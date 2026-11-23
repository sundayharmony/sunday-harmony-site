import { NextRequest, NextResponse } from 'next/server'
import { creditApplicationAccessDenied, viewerFromSession } from '@/lib/credit-expert-assignment'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { shareStaffPdfWithApplicant } from '@/lib/credit-funding-share-pdf'
import { getCreditFundingApplicationById } from '@/lib/credit-funding-db'
import {
  buildCreditRepairProgressPdfInput,
  parseCreditRepairCompareMode,
} from '@/lib/credit-repair-progress-pdf'
import {
  creditRepairProgressPdfFilename,
  renderCreditRepairProgressPdf,
} from '@/lib/credit-repair-progress-pdf-server'
import {
  getDisputeSessionById,
  listDisputeSessionsForApplication,
} from '@/lib/dispute-letters/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** Generate credit progress PDF, share to portal, optionally email the client. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id: applicationId } = await params
  const application = await getCreditFundingApplicationById(applicationId)
  const denied = creditApplicationAccessDenied(viewerFromSession(session), application)
  if (denied) return denied
  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: string
    notifyEmail?: boolean
    compareMode?: string
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  const disputeSession = await getDisputeSessionById(sessionId)
  if (!disputeSession) {
    return NextResponse.json({ error: 'Dispute session not found' }, { status: 404 })
  }
  if (disputeSession.application_uuid && disputeSession.application_uuid !== applicationId) {
    return NextResponse.json(
      { error: 'This credit report is not linked to this application.' },
      { status: 400 }
    )
  }

  const notifyEmail = body.notifyEmail !== false
  const compareMode = parseCreditRepairCompareMode(body.compareMode)
  const staffEmail = session.user?.email || 'admin'
  const staffName = session.user?.name || 'Sunday Harmony Team'

  try {
    let sessions = await listDisputeSessionsForApplication(applicationId)
    if (!sessions.some((s) => s.id === sessionId)) {
      sessions = [...sessions, disputeSession]
    }

    const prepared = buildCreditRepairProgressPdfInput({
      sessions,
      selectedSessionId: sessionId,
      compareMode,
      clientName: application.full_name || application.email,
    })
    if ('error' in prepared) {
      return NextResponse.json({ error: prepared.error }, { status: 400 })
    }

    const pdfBuffer = await renderCreditRepairProgressPdf(prepared)
    const filename = creditRepairProgressPdfFilename(prepared)
    const shared = await shareStaffPdfWithApplicant({
      application,
      pdfBuffer,
      filename,
      staffName,
      staffEmail,
      notifyEmail,
      messageLines: [
          'Your credit progress report PDF is ready.',
          'It shows score movement and account changes between your compared credit reports.',
        ],
      email: {
        statusLabel: 'Credit Progress Shared',
        statusNotes:
          'Your specialist shared a Credit Progress Report PDF showing before-and-after scores and account changes. You can also download it from your client portal.',
        errorLog: 'Failed to send credit progress PDF email:',
      },
      notification: {
        title: 'Credit Progress Report Ready',
        message: 'Your credit progress report PDF is available in your portal.',
      },
    })
    if (!shared.ok) {
      return NextResponse.json({ error: shared.error }, { status: shared.status })
    }

    return NextResponse.json({
      ok: true,
      fileName: shared.displayTitle,
      storagePath: shared.storagePath,
      emailed: notifyEmail,
      messageId: shared.messageId,
      compareMode: prepared.compareMode,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send credit progress PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
