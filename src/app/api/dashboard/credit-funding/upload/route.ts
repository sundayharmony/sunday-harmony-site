import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { requireApplicantCreditFundingAccess } from '@/lib/credit-funding-dashboard-auth'
import {
  fulfillDocumentRequestForApplication,
  createUploadedDocument,
  getDocumentRequests,
} from '@/lib/credit-funding-db'
import { uploadCreditFundingDocument } from '@/lib/credit-funding-storage'
import { getAdminNotifyEmail, sendHtmlMailNonBlocking, escHtml, sanitizeEmailSubjectPart } from '@/lib/smtp-mail'
import type { DocumentType } from '@/lib/credit-funding-types'
import { DOCUMENT_LABELS } from '@/lib/credit-funding-types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const access = await requireApplicantCreditFundingAccess()
    if (!access.ok) return access.response

    const { session, application } = access

    const formData = await req.formData()
    const documentType = formData.get('documentType') as string
    const requestId = formData.get('requestId') as string | null
    const file = formData.get('file')

    if (!documentType || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Document type and file are required' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const upload = await uploadCreditFundingDocument({
      applicationUuid: application.id,
      documentType: documentType as DocumentType,
      buffer,
      contentType: file.type,
      originalFileName: file.name,
    })

    if (!upload.ok) {
      return NextResponse.json({ error: upload.error }, { status: 400 })
    }

    await createUploadedDocument({
      application_uuid: application.id,
      document_type: documentType as DocumentType,
      file_name: upload.data.displayName,
      file_type: upload.data.file_type,
      file_size: upload.data.file_size,
      storage_path: upload.data.storagePath,
      mime_type: upload.data.mime_type,
      scan_status: upload.data.scan_status,
    })

    if (requestId) {
      await fulfillDocumentRequestForApplication(requestId, application.id)
    } else {
      const pending = await getDocumentRequests(application.id)
      const match = pending.find(
        (r) => r.document_type === documentType && r.status === 'pending'
      )
      if (match) await fulfillDocumentRequestForApplication(match.id, application.id)
    }

    sendHtmlMailNonBlocking({
      to: getAdminNotifyEmail(),
      subject: sanitizeEmailSubjectPart(
        `Document uploaded — ${DOCUMENT_LABELS[documentType as DocumentType] || documentType}`,
        200
      ),
      html: `<p>${escHtml(session.user.name || application.full_name)} uploaded ${escHtml(DOCUMENT_LABELS[documentType as DocumentType] || documentType)} for application ${escHtml(application.application_id)}.</p>`,
      logLabel: 'cf-doc-upload-admin',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logApiRouteError(req, 'dashboard/credit-funding/upload', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
