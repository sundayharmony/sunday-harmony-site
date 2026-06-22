import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logApiRouteError } from '@/lib/api-route-log'
import {
  getCreditFundingApplicationByEmail,
  getCreditFundingApplicationByUserId,
  createCreditFundingMessage,
  fulfillDocumentRequest,
  createUploadedDocument,
  getDocumentRequests,
} from '@/lib/credit-funding-db'
import { uploadCreditFundingDocument } from '@/lib/credit-funding-storage'
import { getAdminNotifyEmail, sendHtmlMailNonBlocking, escHtml, sanitizeEmailSubjectPart } from '@/lib/smtp-mail'
import type { DocumentType } from '@/lib/credit-funding-types'
import { DOCUMENT_LABELS } from '@/lib/credit-funding-types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function resolveApplication(email: string, userId: string) {
  const byUser = await getCreditFundingApplicationByUserId(userId)
  if (byUser) return byUser
  return getCreditFundingApplicationByEmail(email)
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const application = await resolveApplication(session.user.email, session.user.id)
    if (!application) {
      return NextResponse.json({ error: 'No application found' }, { status: 404 })
    }

    if (
      application.email.toLowerCase() !== session.user.email.toLowerCase() &&
      application.user_id !== session.user.id
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

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
      await fulfillDocumentRequest(requestId)
    } else {
      const pending = await getDocumentRequests(application.id)
      const match = pending.find(
        (r) => r.document_type === documentType && r.status === 'pending'
      )
      if (match) await fulfillDocumentRequest(match.id)
    }

    sendHtmlMailNonBlocking({
      to: getAdminNotifyEmail(),
      subject: sanitizeEmailSubjectPart(`Document uploaded: ${application.application_id}`, 200),
      html: `<p>${escHtml(session.user.name || application.full_name)} uploaded ${escHtml(DOCUMENT_LABELS[documentType as DocumentType] || documentType)} for application ${escHtml(application.application_id)}.</p>`,
      logLabel: 'cf-doc-upload-admin',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logApiRouteError(req, 'dashboard/credit-funding/upload', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
