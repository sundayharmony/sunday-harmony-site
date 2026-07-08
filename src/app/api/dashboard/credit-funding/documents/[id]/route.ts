import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { requireApplicantCreditFundingAccess } from '@/lib/credit-funding-dashboard-auth'
import { deleteApplicantUploadedDocument } from '@/lib/credit-funding-db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const access = await requireApplicantCreditFundingAccess()
    if (!access.ok) return access.response

    const { application } = access
    const { id } = await context.params

    const result = await deleteApplicantUploadedDocument(id, application.id)

    if (!result.ok) {
      switch (result.reason) {
        case 'not_found':
        case 'wrong_application':
          return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        case 'staff_shared':
          return NextResponse.json({ error: 'This document cannot be deleted' }, { status: 403 })
        case 'delete_failed':
          return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logApiRouteError(_req, 'dashboard/credit-funding/documents/[id]', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
