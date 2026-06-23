import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { logActivity, createNotification, getUserByEmail } from '@/lib/db'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import {
  formatApplicationForAdmin,
  formatApplicationListItemForAdmin,
} from '@/lib/credit-funding-admin'
import {
  sendCreditFundingAdminMessageEmail,
  sendCreditFundingDocumentRequestEmail,
  ensurePortalUserForCreditApplication,
  sendCreditFundingSubmissionEmail,
} from '@/lib/credit-funding-applicant-onboarding'
import { applyWorkflowStatusUpdate } from '@/lib/credit-funding-workflow'
import {
  getCreditFundingApplications,
  getCreditFundingApplicationById,
  getDocumentsByApplicationUuid,
  updateCreditFundingApplication,
  updateCreditFundingApplicationStatus,
  getStatusHistory,
  getCreditFundingMessages,
  getDocumentRequests,
  createDocumentRequest,
  createCreditFundingMessage,
} from '@/lib/credit-funding-db'
import { getCreditFundingDocumentSignedUrl } from '@/lib/credit-funding-storage'
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  type ApplicationStatus,
  type FundingScores,
} from '@/lib/credit-funding-types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const status = searchParams.get('status') || 'all'
    const search = searchParams.get('search') || ''
    const includeDocs = searchParams.get('includeDocs') === 'true'

    if (id) {
      const app = await getCreditFundingApplicationById(id)
      if (!app) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 })
      }

      logActivity({
        action: 'viewed',
        entity_type: 'credit_funding_application',
        entity_id: id,
        actor_email: session.user.email || 'admin',
        details: `Viewed credit funding application ${app.application_id}`,
      })

      const [documents, history, messages, docRequests] = await Promise.all([
        includeDocs ? getDocumentsByApplicationUuid(id) : Promise.resolve([]),
        getStatusHistory(id),
        getCreditFundingMessages(id),
        getDocumentRequests(id),
      ])

      let docsWithUrls = documents
      if (includeDocs) {
        docsWithUrls = await Promise.all(
          documents.map(async (doc) => ({
            ...doc,
            signedUrl: (await getCreditFundingDocumentSignedUrl(doc.storage_path)) || undefined,
          }))
        )
      }

      return NextResponse.json({
        application: formatApplicationForAdmin(app),
        documents: docsWithUrls,
        history,
        messages,
        docRequests,
      })
    }

    const applications = await getCreditFundingApplications({ status, search })
    return NextResponse.json(applications.map(formatApplicationListItemForAdmin))
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding', error)
    return NextResponse.json({ error: 'Failed to load applications' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const body = await req.json()
    const {
      id,
      status,
      assigned_specialist,
      internal_notes,
      client_notes,
      next_steps,
      funding_scores,
      service_type,
      status_notes,
      document_request,
      resend_portal_setup,
    } = body as {
      id?: string
      status?: string
      assigned_specialist?: string
      internal_notes?: string
      client_notes?: string
      next_steps?: string
      funding_scores?: FundingScores
      service_type?: string
      status_notes?: string
      document_request?: { document_type: string; label: string; notes?: string }
      resend_portal_setup?: boolean
    }

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const existing = await getCreditFundingApplicationById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const staffEmail = session.user.email || 'admin'
    let updated = existing

    if (status) {
      if (!APPLICATION_STATUSES.includes(status as ApplicationStatus)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      const result = await applyWorkflowStatusUpdate({
        application: existing,
        status: status as ApplicationStatus,
        staffEmail,
        staffName: session.user.name || 'Sunday Harmony Team',
        statusNotes: status_notes || undefined,
        notifyClient: true,
      })
      if (!result) {
        return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
      }
      updated = result.app

      logActivity({
        action: 'status_changed',
        entity_type: 'credit_funding_application',
        entity_id: id,
        actor_email: staffEmail,
        details: `Status changed to ${STATUS_LABELS[status as ApplicationStatus] || status} for ${existing.application_id}`,
      })
    }

    const fieldUpdates: Parameters<typeof updateCreditFundingApplication>[1] = {}
    if (assigned_specialist !== undefined) fieldUpdates.assigned_specialist = assigned_specialist || null
    if (internal_notes !== undefined) fieldUpdates.internal_notes = internal_notes
    if (client_notes !== undefined) fieldUpdates.client_notes = client_notes
    if (next_steps !== undefined) fieldUpdates.next_steps = next_steps
    if (funding_scores !== undefined) fieldUpdates.funding_scores = funding_scores
    if (service_type !== undefined) fieldUpdates.service_type = service_type

    if (Object.keys(fieldUpdates).length > 0) {
      const result = await updateCreditFundingApplication(id, fieldUpdates)
      if (result) updated = result
    }

    if (funding_scores !== undefined) {
      logActivity({
        action: 'funding_recommendations_added',
        entity_type: 'credit_funding_application',
        entity_id: id,
        actor_email: staffEmail,
        details: `Funding recommendations updated for ${updated.application_id}`,
      })
    }

    if (document_request?.document_type && document_request?.label) {
      await createDocumentRequest({
        application_uuid: id,
        document_type: document_request.document_type,
        label: document_request.label,
        notes: document_request.notes,
        requested_by: staffEmail,
      })

      if (status !== 'documents_pending' && status !== 'additional_information_requested') {
        await updateCreditFundingApplicationStatus(id, 'documents_pending', {
          staffEmail,
          notes: `Document requested: ${document_request.label}`,
        }).then((r) => r?.app ?? null)
      }

      try {
        await sendCreditFundingDocumentRequestEmail({
          to: existing.email,
          applicationId: existing.application_id,
          label: document_request.label,
          notes: document_request.notes,
        })
      } catch (err) {
        console.error('Failed to send document request email:', err)
      }

      if (existing.user_id) {
        await createNotification({
          user_id: existing.user_id,
          title: 'Document Requested',
          message: `Please upload: ${document_request.label}`,
          type: 'file',
          link: '/dashboard/credit-funding',
        })
      } else {
        const user = await getUserByEmail(existing.email)
        if (user) {
          await createNotification({
            user_id: user.id,
            title: 'Document Requested',
            message: `Please upload: ${document_request.label}`,
            type: 'file',
            link: '/dashboard/credit-funding',
          })
        }
      }
    }

    if (resend_portal_setup) {
      const portal = await ensurePortalUserForCreditApplication(existing, { issueSetupCode: true })
      if (portal) {
        try {
          await sendCreditFundingSubmissionEmail({
            to: existing.email,
            fullName: existing.full_name,
            applicationId: existing.application_id,
            setupCode: portal.setupCode,
          })
        } catch (err) {
          console.error('Failed to resend portal setup email:', err)
          return NextResponse.json({ error: 'Failed to send portal setup email' }, { status: 500 })
        }
      }
    }

    logActivity({
      action: 'updated',
      entity_type: 'credit_funding_application',
      entity_id: id,
      actor_email: staffEmail,
      details: `Updated credit funding application ${updated.application_id}`,
    })

    return NextResponse.json(formatApplicationForAdmin(updated))
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding PATCH', error)
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const body = await req.json()
    const { application_id, text } = body as { application_id?: string; text?: string }

    if (!application_id || !text?.trim()) {
      return NextResponse.json({ error: 'application_id and text are required' }, { status: 400 })
    }

    const app = await getCreditFundingApplicationById(application_id)
    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const message = await createCreditFundingMessage({
      application_uuid: application_id,
      from_role: 'admin',
      from_name: session.user.name || 'Sunday Harmony Team',
      from_email: session.user.email || undefined,
      text: text.trim(),
    })

    if (!message) {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    try {
      await sendCreditFundingAdminMessageEmail({
        to: app.email,
        applicationId: app.application_id,
        text: text.trim(),
      })
    } catch (err) {
      console.error('Failed to send admin message email:', err)
    }

    if (app.user_id) {
      await createNotification({
        user_id: app.user_id,
        title: 'New Message',
        message: 'You have a new message about your Credit & Funding application.',
        type: 'message',
        link: '/dashboard/credit-funding',
      })
    }

    return NextResponse.json(message)
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding POST', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
