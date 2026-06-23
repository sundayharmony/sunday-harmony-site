import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logApiRouteError } from '@/lib/api-route-log'
import {
  getCreditFundingApplicationByEmail,
  getCreditFundingApplicationByUserId,
  getDocumentsByApplicationUuid,
  getDocumentRequests,
  getStatusHistory,
  getCreditFundingMessages,
} from '@/lib/credit-funding-db'
import { getCreditFundingDocumentSignedUrl } from '@/lib/credit-funding-storage'
import { documentDisplayLabel } from '@/lib/credit-funding-types'

export const dynamic = 'force-dynamic'

async function resolveApplicantApplication(email: string, userId: string) {
  const byUser = await getCreditFundingApplicationByUserId(userId)
  if (byUser) return byUser
  return getCreditFundingApplicationByEmail(email)
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const email = session.user.email

    const application = await resolveApplicantApplication(email, userId)
    if (!application) {
      return NextResponse.json({ error: 'No application found for this account' }, { status: 404 })
    }

    if (
      application.email.toLowerCase() !== email.toLowerCase() &&
      application.user_id !== userId
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const [history, documents, docRequests, messages] = await Promise.all([
      getStatusHistory(application.id),
      getDocumentsByApplicationUuid(application.id),
      getDocumentRequests(application.id),
      getCreditFundingMessages(application.id),
    ])

    const docsWithUrls = await Promise.all(
      documents.map(async (doc) => ({
        id: doc.id,
        document_type: doc.document_type,
        file_name: doc.file_name,
        file_size: doc.file_size,
        scan_status: doc.scan_status,
        shared_by: doc.shared_by || 'applicant',
        label: documentDisplayLabel(doc.document_type),
        created_at: doc.created_at,
        signedUrl: (await getCreditFundingDocumentSignedUrl(doc.storage_path)) || undefined,
      }))
    )

    const applicantDocuments = docsWithUrls.filter((d) => d.shared_by !== 'admin')
    const teamDocuments = docsWithUrls.filter((d) => d.shared_by === 'admin')

    return NextResponse.json({
      application: {
        id: application.id,
        application_id: application.application_id,
        full_name: application.full_name,
        email: application.email,
        status: application.status,
        service_type: application.service_type,
        assigned_specialist: application.assigned_specialist,
        client_notes: application.client_notes,
        next_steps: application.next_steps,
        funding_scores: application.funding_scores,
        created_at: application.created_at,
        updated_at: application.updated_at,
      },
      history,
      documents: applicantDocuments,
      teamDocuments,
      docRequests,
      messages,
    })
  } catch (error) {
    logApiRouteError({ url: '/api/dashboard/credit-funding' } as NextRequest, 'dashboard/credit-funding GET', error)
    return NextResponse.json({ error: 'Failed to load application' }, { status: 500 })
  }
}
