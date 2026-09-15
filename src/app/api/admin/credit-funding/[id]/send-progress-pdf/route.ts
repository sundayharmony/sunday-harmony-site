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
import { sanitizeDocumentDisplayTitle } from '@/lib/credit-funding-types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

async function notifyApplicant(
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

/** Generate credit progress PDF, share to portal, optionally email the client. */
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
        'Your credit progress report PDF is ready.',
        'It shows score movement and account changes between your compared credit reports.',
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
          statusLabel: 'Credit Progress Shared',
          statusNotes:
            'Your specialist shared a Credit Progress Report PDF showing before-and-after scores and account changes. You can also download it from your client portal.',
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
        console.error('Failed to send credit progress PDF email:', err)
      }

      await notifyApplicant(
        application.email,
        application.user_id,
        'Credit Progress Report Ready',
        'Your credit progress report PDF is available in your portal.'
      )
    }

    return NextResponse.json({
      ok: true,
      fileName: displayTitle,
      storagePath: uploaded.data.storagePath,
      emailed: notifyEmail,
      messageId: message?.id || null,
      compareMode: prepared.compareMode,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send credit progress PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
