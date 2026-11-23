import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { creditApplicationAccessDenied, viewerFromSession } from '@/lib/credit-expert-assignment'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { getCreditFundingApplicationById, getUploadedDocumentById } from '@/lib/credit-funding-db'

type StaffDocumentAccess =
  | { ok: false; response: Response }
  | {
      ok: true
      session: Session
      applicationId: string
      application: NonNullable<Awaited<ReturnType<typeof getCreditFundingApplicationById>>>
      id: string
      doc: NonNullable<Awaited<ReturnType<typeof getUploadedDocumentById>>>
    }

/**
 * Staff session + `?applicationId=` access check + document ownership, shared by the
 * admin credit-funding document routes.
 */
export async function requireStaffDocumentAccess(
  req: NextRequest,
  params: Promise<{ id: string }>
): Promise<StaffDocumentAccess> {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return { ok: false, response: session }

  const applicationId = new URL(req.url).searchParams.get('applicationId')
  if (!applicationId) {
    return { ok: false, response: NextResponse.json({ error: 'applicationId is required' }, { status: 400 }) }
  }

  const application = await getCreditFundingApplicationById(applicationId)
  const denied = creditApplicationAccessDenied(viewerFromSession(session), application)
  if (denied) return { ok: false, response: denied }
  if (!application) {
    return { ok: false, response: NextResponse.json({ error: 'Application not found' }, { status: 404 }) }
  }

  const { id } = await params
  const doc = await getUploadedDocumentById(id)
  if (!doc || doc.application_uuid !== applicationId) {
    return { ok: false, response: NextResponse.json({ error: 'Document not found' }, { status: 404 }) }
  }

  return { ok: true, session, applicationId, application, id, doc }
}
