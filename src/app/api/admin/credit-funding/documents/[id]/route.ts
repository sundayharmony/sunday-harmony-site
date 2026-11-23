import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { logActivity } from '@/lib/db'
import { requireStaffDocumentAccess } from '@/lib/credit-funding-document-access'
import {
  deleteAdminUploadedDocument,
  getCreditFundingApplicationById,
  getUploadedDocumentById,
  replaceUploadedDocument,
} from '@/lib/credit-funding-db'
import { getCreditFundingDocumentSignedUrl } from '@/lib/credit-funding-storage'
import { documentDisplayLabel } from '@/lib/credit-funding-types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const access = await requireStaffDocumentAccess(req, context.params)
    if (!access.ok) return access.response
    const { id, doc } = access

    const url = await getCreditFundingDocumentSignedUrl(doc.storage_path)
    if (!url) {
      return NextResponse.json({ error: 'Could not open document' }, { status: 404 })
    }

    return NextResponse.json({
      url,
      fileName: doc.file_name,
      documentType: doc.document_type,
    })
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/documents/[id] GET', error)
    return NextResponse.json({ error: 'Failed to open document' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const access = await requireStaffDocumentAccess(req, context.params)
    if (!access.ok) return access.response
    const { session, applicationId, application, id, doc: existing } = access

    const result = await deleteAdminUploadedDocument(id, applicationId)
    if (!result.ok) {
      switch (result.reason) {
        case 'not_found':
        case 'wrong_application':
          return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        case 'delete_failed':
          return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
        default:
          return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
      }
    }

    logActivity({
      action: 'deleted',
      entity_type: 'credit_funding_document',
      entity_id: id,
      actor_email: session.user.email || 'admin',
      details: `Deleted ${documentDisplayLabel(existing.document_type)} (${existing.file_name}) from application ${application.application_id}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/documents/[id]', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const access = await requireStaffDocumentAccess(req, context.params)
    if (!access.ok) return access.response
    const { session, applicationId, application, id, doc: existing } = access

    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'A replacement file is required' }, { status: 400 })
    }

    const result = await replaceUploadedDocument({
      documentId: id,
      applicationUuid: applicationId,
      buffer: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      originalFileName: file.name,
      allowStaffShared: true,
    })
    if (!result.ok) {
      switch (result.reason) {
        case 'not_found':
        case 'wrong_application':
          return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        case 'staff_shared':
          return NextResponse.json({ error: 'This document cannot be replaced' }, { status: 403 })
        case 'upload_failed':
          return NextResponse.json({ error: result.error || 'Replacement upload failed' }, { status: 400 })
        default:
          return NextResponse.json({ error: 'Failed to replace document' }, { status: 500 })
      }
    }

    logActivity({
      action: 'updated',
      entity_type: 'credit_funding_document',
      entity_id: result.document.id,
      actor_email: session.user.email || 'admin',
      details: `Set letter copy for ${documentDisplayLabel(existing.document_type)} on ${application.application_id} (kept original ${result.original.file_name}; letters now use ${result.document.file_name})`,
    })

    return NextResponse.json({
      success: true,
      documentType: existing.document_type,
      fileName: result.document.file_name,
      originalFileName: result.original.file_name,
    })
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/documents/[id] PUT', error)
    return NextResponse.json({ error: 'Replace failed' }, { status: 500 })
  }
}
