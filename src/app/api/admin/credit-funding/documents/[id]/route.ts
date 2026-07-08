import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { logActivity } from '@/lib/db'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import {
  deleteAdminUploadedDocument,
  getCreditFundingApplicationById,
  getUploadedDocumentById,
} from '@/lib/credit-funding-db'
import { documentDisplayLabel } from '@/lib/credit-funding-types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const applicationId = new URL(req.url).searchParams.get('applicationId')
    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 })
    }

    const application = await getCreditFundingApplicationById(applicationId)
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
