import { createNotification, getUserByEmail } from '@/lib/db'
import {
  createCreditFundingMessage,
  createUploadedDocument,
  updateCreditFundingApplicationStatus,
} from '@/lib/credit-funding-db'
import {
  sendCreditFundingStatusUpdateEmail,
  sendCreditFundingWorkflowUpdateEmail,
} from '@/lib/credit-funding-applicant-onboarding'
import { uploadCreditFundingDocument } from '@/lib/credit-funding-storage'
import {
  STATUS_LABELS,
  type ApplicationStatus,
  type CreditFundingApplication,
} from '@/lib/credit-funding-types'

export interface WorkflowAttachmentInput {
  buffer: Buffer
  contentType: string
  originalFileName: string
}

export interface ApplyWorkflowStatusParams {
  application: CreditFundingApplication
  status: ApplicationStatus
  staffEmail: string
  staffName: string
  statusNotes?: string
  attachments?: WorkflowAttachmentInput[]
  notifyClient?: boolean
}

export interface ApplyWorkflowStatusResult {
  app: CreditFundingApplication
  attachmentNames: string[]
  messageCreated: boolean
  savedAttachmentCount: number
}

function buildPortalMessageText(params: {
  statusLabel: string
  statusNotes?: string
  attachmentNames: string[]
}): string {
  const parts: string[] = [`Application update: ${params.statusLabel}.`]
  if (params.statusNotes?.trim()) {
    parts.push(params.statusNotes.trim())
  }
  if (params.attachmentNames.length > 0) {
    parts.push(`Attached: ${params.attachmentNames.join(', ')}`)
  }
  return parts.join('\n\n')
}

async function notifyApplicantUser(
  application: CreditFundingApplication,
  title: string,
  message: string,
  type: 'info' | 'file' | 'message' = 'info'
): Promise<void> {
  if (application.user_id) {
    await createNotification({
      user_id: application.user_id,
      title,
      message,
      type,
      link: '/dashboard/credit-funding',
    })
    return
  }

  const user = await getUserByEmail(application.email)
  if (user) {
    await createNotification({
      user_id: user.id,
      title,
      message,
      type,
      link: '/dashboard/credit-funding',
    })
  }
}

export async function applyWorkflowStatusUpdate(
  params: ApplyWorkflowStatusParams
): Promise<ApplyWorkflowStatusResult | null> {
  const {
    application,
    status,
    staffEmail,
    staffName,
    statusNotes,
    attachments = [],
    notifyClient = true,
  } = params

  const statusLabel = STATUS_LABELS[status] || status
  const notes = statusNotes?.trim() || `Status updated to ${statusLabel}`

  const result = await updateCreditFundingApplicationStatus(application.id, status, {
    staffEmail,
    notes,
  })
  if (!result) return null

  const attachmentNames: string[] = []
  const uploadedRecords: Array<{
    displayName: string
    file_type: string
    file_size: number
    storagePath: string
    mime_type: string
    scan_status: 'clean' | 'rejected'
  }> = []

  for (const file of attachments) {
    const uploaded = await uploadCreditFundingDocument({
      applicationUuid: application.id,
      documentType: 'staff_shared',
      buffer: file.buffer,
      contentType: file.contentType,
      originalFileName: file.originalFileName,
    })
    if (!uploaded.ok) continue
    attachmentNames.push(uploaded.data.displayName)
    uploadedRecords.push(uploaded.data)
  }

  const hasClientContent = Boolean(statusNotes?.trim()) || attachmentNames.length > 0
  let messageCreated = false
  let messageId: string | undefined

  if (hasClientContent) {
    const message = await createCreditFundingMessage({
      application_uuid: application.id,
      from_role: 'admin',
      from_name: staffName,
      from_email: staffEmail,
      text: buildPortalMessageText({ statusLabel, statusNotes, attachmentNames }),
    })
    messageCreated = Boolean(message)
    messageId = message?.id
  }

  let savedAttachmentCount = 0

  for (const uploaded of uploadedRecords) {
    const saved = await createUploadedDocument({
      application_uuid: application.id,
      document_type: 'staff_shared',
      file_name: uploaded.displayName,
      file_type: uploaded.file_type,
      file_size: uploaded.file_size,
      storage_path: uploaded.storagePath,
      mime_type: uploaded.mime_type,
      scan_status: uploaded.scan_status,
      shared_by: 'admin',
      status_history_id: result.history.id,
      message_id: messageId,
    })
    if (saved) savedAttachmentCount++
    else {
      console.error('Failed to persist staff attachment to database:', uploaded.displayName, uploaded.storagePath)
    }
  }

  if (uploadedRecords.length > 0 && savedAttachmentCount === 0) {
    console.error(
      'Staff attachments uploaded to storage but not saved to database. Run supabase-migration-012-credit-funding-workflow-attachments.sql'
    )
  }

  if (notifyClient) {
    const emailParams = {
      to: application.email,
      applicationId: application.application_id,
      statusLabel,
      statusNotes: statusNotes?.trim() || undefined,
      attachmentNames,
    }

    try {
      if (hasClientContent) {
        await sendCreditFundingWorkflowUpdateEmail(emailParams)
      } else {
        await sendCreditFundingStatusUpdateEmail(emailParams)
      }
    } catch (err) {
      console.error('Failed to send workflow update email:', err)
    }

    const notificationMessage =
      attachmentNames.length > 0
        ? `${statusLabel} — ${attachmentNames.length} document${attachmentNames.length !== 1 ? 's' : ''} shared`
        : statusNotes?.trim()
          ? `${statusLabel}: ${statusNotes.trim().slice(0, 120)}`
          : `Your application is now: ${statusLabel}`

    await notifyApplicantUser(
      application,
      'Application Update',
      notificationMessage,
      attachmentNames.length > 0 ? 'file' : 'info'
    )
  }

  return {
    app: result.app,
    attachmentNames,
    messageCreated,
    savedAttachmentCount,
  }
}
