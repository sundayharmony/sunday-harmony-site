import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { logActivity } from '@/lib/db'
import { creditApplicationAccessDenied, viewerFromSession } from '@/lib/credit-expert-assignment'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import {
  createUploadedDocument,
  getCreditFundingApplicationById,
} from '@/lib/credit-funding-db'
import { uploadCreditFundingDocument } from '@/lib/credit-funding-storage'
import { documentDisplayLabel, isDocumentType } from '@/lib/credit-funding-types'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { isUuid } from '@/lib/uuid'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const staffEmail = session.user.email || 'admin'
    const rl = await rateLimitDurable(`cf-app-docs:${staffEmail}`, 40, 15 * 60 * 1000)
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const { id } = await params
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Invalid application id' }, { status: 400 })
    }

    const application = await getCreditFundingApplicationById(id)
    const denied = creditApplicationAccessDenied(viewerFromSession(session), application)
    if (denied) return denied
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const formData = await req.formData()
    const documentType = String(formData.get('documentType') || '')
    const file = formData.get('file')
    if (!documentType || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Document type and file are required' }, { status: 400 })
    }
    if (!isDocumentType(documentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const upload = await uploadCreditFundingDocument({
      applicationUuid: application.id,
      documentType,
      buffer,
      contentType: file.type,
      originalFileName: file.name,
    })
    if (!upload.ok) {
      return NextResponse.json({ error: upload.error }, { status: 400 })
    }

    const doc = await createUploadedDocument({
      application_uuid: application.id,
      document_type: documentType,
      file_name: upload.data.displayName,
      file_type: upload.data.file_type,
      file_size: upload.data.file_size,
      storage_path: upload.data.storagePath,
      mime_type: upload.data.mime_type,
      scan_status: upload.data.scan_status,
      shared_by: 'admin',
    })
    if (!doc) {
      return NextResponse.json(
        {
          error:
            documentType === 'ssn_card'
              ? 'Could not save Social Security Card. Run supabase-migration-056-ssn-card-document.sql in Supabase, then try again.'
              : 'Failed to save document',
        },
        { status: 500 }
      )
    }

    logActivity({
      action: 'updated',
      entity_type: 'credit_funding_document',
      entity_id: doc.id,
      actor_email: staffEmail,
      details: `Uploaded ${documentDisplayLabel(documentType)} (${doc.file_name}) on application ${application.application_id}`,
    })

    return NextResponse.json({
      success: true,
      documentType,
      fileName: doc.file_name,
    })
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/[id]/documents POST', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
