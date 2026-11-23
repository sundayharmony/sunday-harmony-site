import { NextRequest, NextResponse } from 'next/server'
import { creditApplicationAccessDenied, viewerFromSession } from '@/lib/credit-expert-assignment'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { shareStaffPdfWithApplicant } from '@/lib/credit-funding-share-pdf'
import { getCreditFundingApplicationById } from '@/lib/credit-funding-db'
import {
  creditIntelligencePdfFilename,
  renderCreditIntelligencePdf,
} from '@/lib/credit-intelligence-pdf-server'
import { resolveCreditIntelligenceForSession } from '@/lib/credit-intelligence-resolve'
import { getDisputeSessionById } from '@/lib/dispute-letters/db'
import type { FundingContextPayload } from '@/lib/dispute-letters/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** Generate Credit Intelligence PDF, share to portal, optionally email the client. */
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
    funding_context?: FundingContextPayload
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
  const staffEmail = session.user?.email || 'admin'
  const staffName = session.user?.name || 'Sunday Harmony Team'

  try {
    const resolved = await resolveCreditIntelligenceForSession({
      sessionId,
      fundingContext: body.funding_context || null,
      rebuildIfMissing: true,
    })
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    const pdfBuffer = await renderCreditIntelligencePdf(resolved.report)
    const filename = creditIntelligencePdfFilename(resolved.report)
    const shared = await shareStaffPdfWithApplicant({
      application,
      pdfBuffer,
      filename,
      staffName,
      staffEmail,
      notifyEmail,
      messageLines: ['Your credit profile analysis PDF is ready.'],
      email: {
        statusLabel: 'Credit Analysis Shared',
        statusNotes:
          'Your specialist shared a Credit Profile Analysis PDF. You can also download it from your client portal.',
        errorLog: 'Failed to send credit analysis PDF email:',
      },
      notification: {
        title: 'Credit Analysis Ready',
        message: 'Your credit profile analysis PDF is available in your portal.',
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
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send credit analysis PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
