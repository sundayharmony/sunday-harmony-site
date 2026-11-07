import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { logActivity } from '@/lib/db'
import { creditApplicationAccessDenied, viewerFromSession } from '@/lib/credit-expert-assignment'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
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
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const applicationId = new URL(req.url).searchParams.get('applicationId')
    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 })
    }

    const application = await getCreditFundingApplicationById(applicationId)
    const denied = creditApplicationAccessDenied(viewerFromSession(session), application)
    if (denied) return denied
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const { id } = await context.params
    const doc = await getUploadedDocumentById(id)
    if (!doc || doc.application_uuid !== applicationId) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

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
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const applicationId = new URL(req.url).searchParams.get('applicationId')
    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 })
    }

    const application = await getCreditFundingApplicationById(applicationId)
    const denied = creditApplicationAccessDenied(viewerFromSession(session), application)
    if (denied) return denied
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const { id } = await context.params
    const existing = await getUploadedDocumentById(id)
    if (!existing || existing.application_uuid !== applicationId) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

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
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const applicationId = new URL(req.url).searchParams.get('applicationId')
    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 })
    }

    const application = await getCreditFundingApplicationById(applicationId)
    const denied = creditApplicationAccessDenied(viewerFromSession(session), application)
    if (denied) return denied
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const { id } = await context.params
    const existing = await getUploadedDocumentById(id)
    if (!existing || existing.application_uuid !== applicationId) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

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
