import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { logActivity, createNotification, getUserByEmail } from '@/lib/db'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { maskEmail, maskPhone, maskSecret } from '@/lib/field-encryption'
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
import {
  escHtml,
  getPublicSiteUrl,
  sanitizeEmailSubjectPart,
  sendHtmlMailNonBlocking,
} from '@/lib/smtp-mail'

export const dynamic = 'force-dynamic'

function maskApplication(app: Awaited<ReturnType<typeof getCreditFundingApplicationById>>) {
  if (!app) return null
  const bp = app.business_profile as Record<string, unknown> | undefined
  return {
    ...app,
    email: maskEmail(app.email),
    phone: maskPhone(app.phone),
    date_of_birth_encrypted: undefined,
    provider_username_encrypted: maskSecret(app.provider_username_encrypted || ''),
    provider_password_encrypted: maskSecret(app.provider_password_encrypted || ''),
    business_profile: bp
      ? { ...bp, einEncrypted: bp.einEncrypted ? maskSecret('encrypted') : undefined }
      : {},
  }
}

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
        application: maskApplication(app),
        documents: docsWithUrls,
        history,
        messages,
        docRequests,
      })
    }

    const applications = await getCreditFundingApplications({ status, search })
    const masked = applications.map((a) => ({
      id: a.id,
      application_id: a.application_id,
      full_name: a.full_name,
      email: maskEmail(a.email),
      phone: maskPhone(a.phone),
      service_type: a.service_type,
      credit_goals: a.credit_goals,
      funding_goals: a.funding_goals,
      selected_credit_provider: a.selected_credit_provider,
      status: a.status,
      assigned_specialist: a.assigned_specialist,
      created_at: a.created_at,
      updated_at: a.updated_at,
    }))

    return NextResponse.json(masked)
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
      const result = await updateCreditFundingApplicationStatus(id, status as ApplicationStatus, {
        staffEmail,
        notes: status_notes || `Status updated to ${STATUS_LABELS[status as ApplicationStatus] || status}`,
      })
      if (!result) {
        return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
      }
      updated = result

      logActivity({
        action: 'status_changed',
        entity_type: 'credit_funding_application',
        entity_id: id,
        actor_email: staffEmail,
        details: `Status changed to ${STATUS_LABELS[status as ApplicationStatus] || status} for ${existing.application_id}`,
      })

      sendHtmlMailNonBlocking({
        to: existing.email,
        subject: sanitizeEmailSubjectPart(`Application Update — ${existing.application_id}`, 200),
        html: `
          <div style="font-family:'Montserrat',Arial,sans-serif;max-width:600px">
            <h2 style="color:#b8943f">Application Status Update</h2>
            <p>Your Credit &amp; Funding application <strong>${escHtml(existing.application_id)}</strong> status is now:</p>
            <p style="padding:12px;background:#fafafa;border-radius:8px;font-weight:bold">${escHtml(STATUS_LABELS[status as ApplicationStatus] || status)}</p>
            ${status_notes ? `<p>${escHtml(status_notes)}</p>` : ''}
            <p><a href="${escHtml(getPublicSiteUrl())}/dashboard/credit-funding" style="color:#b8943f">View your portal</a></p>
          </div>
        `,
        logLabel: 'cf-status-update',
      })

      if (existing.user_id) {
        await createNotification({
          user_id: existing.user_id,
          title: 'Application Status Updated',
          message: `Your application is now: ${STATUS_LABELS[status as ApplicationStatus] || status}`,
          type: 'info',
          link: '/dashboard/credit-funding',
        })
      } else {
        const user = await getUserByEmail(existing.email)
        if (user) {
          await createNotification({
            user_id: user.id,
            title: 'Application Status Updated',
            message: `Your application is now: ${STATUS_LABELS[status as ApplicationStatus] || status}`,
            type: 'info',
            link: '/dashboard/credit-funding',
          })
        }
      }
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
        })
      }

      sendHtmlMailNonBlocking({
        to: existing.email,
        subject: sanitizeEmailSubjectPart(`Document Requested — ${existing.application_id}`, 200),
        html: `
          <p>We need an additional document for your application <strong>${escHtml(existing.application_id)}</strong>:</p>
          <p style="padding:12px;background:#fafafa;border-radius:8px"><strong>${escHtml(document_request.label)}</strong></p>
          ${document_request.notes ? `<p>${escHtml(document_request.notes)}</p>` : ''}
          <p>Please upload via your <a href="${escHtml(getPublicSiteUrl())}/dashboard/credit-funding">client portal</a>.</p>
        `,
        logLabel: 'cf-doc-request',
      })

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

    logActivity({
      action: 'updated',
      entity_type: 'credit_funding_application',
      entity_id: id,
      actor_email: staffEmail,
      details: `Updated credit funding application ${updated.application_id}`,
    })

    return NextResponse.json(maskApplication(updated))
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

    sendHtmlMailNonBlocking({
      to: app.email,
      subject: sanitizeEmailSubjectPart(`Message from Sunday Harmony — ${app.application_id}`, 200),
      html: `
        <p>You have a new message regarding application <strong>${escHtml(app.application_id)}</strong>:</p>
        <div style="padding:12px;background:#f8f6f0;border-radius:8px;margin:12px 0;white-space:pre-wrap">${escHtml(text.trim())}</div>
        <p><a href="${escHtml(getPublicSiteUrl())}/dashboard/credit-funding">Reply in your portal</a></p>
      `,
      logLabel: 'cf-admin-message',
    })

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
