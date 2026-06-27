import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { requireApplicantCreditFundingAccess } from '@/lib/credit-funding-dashboard-auth'
import {
  getDocumentsByApplicationUuid,
  getDocumentRequests,
  getStatusHistory,
  getCreditFundingMessages,
  syncStaffSharedDocumentsFromStorage,
} from '@/lib/credit-funding-db'
import { getCreditFundingDocumentSignedUrl } from '@/lib/credit-funding-storage'
import { documentDisplayLabel, isStaffSharedDocument } from '@/lib/credit-funding-types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const access = await requireApplicantCreditFundingAccess()
    if (!access.ok) return access.response

    const { application } = access

    const [history, docRequests, messages] = await Promise.all([
      getStatusHistory(application.id),
      getDocumentRequests(application.id),
      getCreditFundingMessages(application.id),
    ])

    await syncStaffSharedDocumentsFromStorage(application.id)
    const documents = await getDocumentsByApplicationUuid(application.id)

    const docsWithUrls = await Promise.all(
      documents.map(async (doc) => ({
        id: doc.id,
        document_type: doc.document_type,
        file_name: doc.file_name,
        file_size: doc.file_size,
        scan_status: doc.scan_status,
        shared_by: doc.shared_by || (isStaffSharedDocument(doc) ? 'admin' : 'applicant'),
        message_id: doc.message_id || null,
        storage_path: doc.storage_path,
        mime_type: doc.mime_type,
        file_type: doc.file_type,
        label: documentDisplayLabel(doc.document_type),
        created_at: doc.created_at,
        signedUrl: (await getCreditFundingDocumentSignedUrl(doc.storage_path)) || undefined,
      }))
    )

    const applicantDocuments = docsWithUrls.filter((d) => !isStaffSharedDocument(d))
    const teamDocuments = docsWithUrls.filter((d) => isStaffSharedDocument(d))

    const messagesWithAttachments = messages.map((message) => ({
      ...message,
      attachments: teamDocuments
        .filter(
          (doc) =>
            doc.message_id === message.id ||
            (message.from_role === 'admin' &&
              message.text.includes('Attached:') &&
              message.text.includes(doc.file_name))
        )
        .map((doc) => ({
          id: doc.id,
          file_name: doc.file_name,
          signedUrl: doc.signedUrl,
          mime_type: doc.mime_type,
          file_type: doc.file_type,
        })),
    }))

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
      messages: messagesWithAttachments,
    })
  } catch (error) {
    logApiRouteError({ url: '/api/dashboard/credit-funding' } as NextRequest, 'dashboard/credit-funding GET', error)
    return NextResponse.json({ error: 'Failed to load application' }, { status: 500 })
  }
}
