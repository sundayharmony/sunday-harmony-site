import { sendCreditFundingStatusUpdateEmail } from '@/lib/credit-funding-applicant-onboarding'
import {
  createCreditFundingMessage,
  createUploadedDocument,
  syncStaffSharedDocumentsFromStorage,
} from '@/lib/credit-funding-db'
import {
  deleteCreditFundingStoragePaths,
  uploadCreditFundingDocument,
} from '@/lib/credit-funding-storage'
import {
  sanitizeDocumentDisplayTitle,
  type CreditFundingApplication,
} from '@/lib/credit-funding-types'
import { notifyApplicantUser } from '@/lib/credit-funding-workflow'

type ShareStaffPdfInput = {
  application: CreditFundingApplication
  pdfBuffer: Buffer
  filename: string
  staffName: string
  staffEmail: string
  notifyEmail: boolean
  /** Portal message lines; `Attached: <title>` is appended. */
  messageLines: string[]
  email: { statusLabel: string; statusNotes: string; errorLog: string }
  notification: { title: string; message: string }
}

export type ShareStaffPdfResult =
  | { ok: true; displayTitle: string; storagePath: string; messageId: string | null }
  | { ok: false; error: string; status: number }

/** Upload a staff PDF to the client portal, post it as a message, and optionally email + notify the client. */
export async function shareStaffPdfWithApplicant(input: ShareStaffPdfInput): Promise<ShareStaffPdfResult> {
  const { application, pdfBuffer, filename } = input
  const displayTitle = sanitizeDocumentDisplayTitle(filename.replace(/\.pdf$/i, ''), filename)

  const uploaded = await uploadCreditFundingDocument({
    applicationUuid: application.id,
    documentType: 'staff_shared',
    buffer: pdfBuffer,
    contentType: 'application/pdf',
    originalFileName: filename,
  })
  if (!uploaded.ok) return { ok: false, error: uploaded.error, status: 400 }

  const message = await createCreditFundingMessage({
    application_uuid: application.id,
    from_role: 'admin',
    from_name: input.staffName,
    from_email: input.staffEmail,
    text: [...input.messageLines, `Attached: ${displayTitle}`].join('\n\n'),
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
      return { ok: false, error: 'PDF uploaded but could not be saved for portal display.', status: 500 }
    }
  }

  if (input.notifyEmail) {
    try {
      await sendCreditFundingStatusUpdateEmail({
        to: application.email,
        applicationId: application.application_id,
        statusLabel: input.email.statusLabel,
        statusNotes: input.email.statusNotes,
        attachmentNames: [displayTitle],
        attachments: [{ fileName: filename, mimeType: 'application/pdf', buffer: pdfBuffer }],
      })
    } catch (err) {
      console.error(input.email.errorLog, err)
    }

    await notifyApplicantUser(application, input.notification.title, input.notification.message, 'file')
  }

  return { ok: true, displayTitle, storagePath: uploaded.data.storagePath, messageId: message?.id || null }
}
