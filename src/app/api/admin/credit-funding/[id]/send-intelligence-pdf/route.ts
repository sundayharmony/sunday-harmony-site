import { NextRequest, NextResponse } from 'next/server'
import { createNotification, getUserByEmail } from '@/lib/db'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { sendCreditFundingStatusUpdateEmail } from '@/lib/credit-funding-applicant-onboarding'
import {
  createCreditFundingMessage,
  createUploadedDocument,
  getCreditFundingApplicationById,
  syncStaffSharedDocumentsFromStorage,
} from '@/lib/credit-funding-db'
import {
  deleteCreditFundingStoragePaths,
  uploadCreditFundingDocument,
} from '@/lib/credit-funding-storage'
import {
  creditIntelligencePdfFilename,
  renderCreditIntelligencePdf,
} from '@/lib/credit-intelligence-pdf-server'
import { resolveCreditIntelligenceForSession } from '@/lib/credit-intelligence-resolve'
import { getDisputeSessionById } from '@/lib/dispute-letters/db'
import { sanitizeDocumentDisplayTitle } from '@/lib/credit-funding-types'
import type { FundingContextPayload } from '@/lib/dispute-letters/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

async function notifyApplicant(
  applicationId: string,
  email: string,
  userId: string | null | undefined,
  title: string,
  message: string
) {
  if (userId) {
    await createNotification({
      user_id: userId,
      title,
      message,
      type: 'file',
      link: '/dashboard/credit-funding',
    })
    return
  }
  const user = await getUserByEmail(email)
  if (user) {
    await createNotification({
      user_id: user.id,
      title,
      message,
      type: 'file',
      link: '/dashboard/credit-funding',
    })
  }
}

/** Generate Credit Intelligence PDF, share to portal, optionally email the client. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id: applicationId } = await params
  const application = await getCreditFundingApplicationById(applicationId)
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
    const displayTitle = sanitizeDocumentDisplayTitle(
      filename.replace(/\.pdf$/i, ''),
      filename
    )

    const uploaded = await uploadCreditFundingDocument({
      applicationUuid: application.id,
      documentType: 'staff_shared',
      buffer: pdfBuffer,
      contentType: 'application/pdf',
      originalFileName: filename,
    })
    if (!uploaded.ok) {
      return NextResponse.json({ error: uploaded.error }, { status: 400 })
    }

    const message = await createCreditFundingMessage({
      application_uuid: application.id,
      from_role: 'admin',
      from_name: staffName,
      from_email: staffEmail,
      text: [
        'Your credit profile analysis PDF is ready.',
        `Attached: ${displayTitle}`,
      ].join('\n\n'),
    })

    const saved = await createUploadedDocument({
      application_uuid: application.id,
      document_type: 'staff_shared',
      file_name: displayTitle,
      file_type: uploaded.data.file_type,
      file_size: uploaded.data.file_size,
      storage_path: uploaded.data.storagePath,
      mime_type: uploaded.data.mime_type,
      scan_status: uploaded.data.scan_status,
      shared_by: 'admin',
      message_id: message?.id,
    })

    if (!saved) {
      const recovered = await syncStaffSharedDocumentsFromStorage(application.id)
      if (!recovered) {
        await deleteCreditFundingStoragePaths([uploaded.data.storagePath]).catch(() => {})
        return NextResponse.json(
          { error: 'PDF uploaded but could not be saved for portal display.' },
          { status: 500 }
        )
      }
    }

    if (notifyEmail) {
      try {
        await sendCreditFundingStatusUpdateEmail({
          to: application.email,
          applicationId: application.application_id,
          statusLabel: 'Credit Analysis Shared',
          statusNotes:
            'Your specialist shared a Credit Profile Analysis PDF. You can also download it from your client portal.',
          attachmentNames: [displayTitle],
          attachments: [
            {
              fileName: filename,
              mimeType: 'application/pdf',
              buffer: pdfBuffer,
            },
          ],
        })
      } catch (err) {
        console.error('Failed to send credit analysis PDF email:', err)
      }

      await notifyApplicant(
        application.id,
        application.email,
        application.user_id,
        'Credit Analysis Ready',
        'Your credit profile analysis PDF is available in your portal.'
      )
    }

    return NextResponse.json({
      ok: true,
      fileName: displayTitle,
      storagePath: uploaded.data.storagePath,
      emailed: notifyEmail,
      messageId: message?.id || null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send credit analysis PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
