import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { logActivity } from '@/lib/db'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { maskEmail, maskPhone, maskSecret } from '@/lib/field-encryption'
import {
  getCreditFundingApplications,
  getCreditFundingApplicationById,
  getDocumentsByApplicationUuid,
  updateCreditFundingApplicationStatus,
} from '@/lib/credit-funding-db'
import { getCreditFundingDocumentSignedUrl } from '@/lib/credit-funding-storage'
import { APPLICATION_STATUSES, type ApplicationStatus } from '@/lib/credit-funding-types'

export const dynamic = 'force-dynamic'

function maskApplication(app: Awaited<ReturnType<typeof getCreditFundingApplicationById>>) {
  if (!app) return null
  return {
    ...app,
    email: maskEmail(app.email),
    phone: maskPhone(app.phone),
    date_of_birth_encrypted: undefined,
    provider_username_encrypted: maskSecret(app.provider_username_encrypted || ''),
    provider_password_encrypted: maskSecret(app.provider_password_encrypted || ''),
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

      let documents = includeDocs ? await getDocumentsByApplicationUuid(id) : []
      if (includeDocs) {
        documents = await Promise.all(
          documents.map(async (doc) => ({
            ...doc,
            signedUrl: (await getCreditFundingDocumentSignedUrl(doc.storage_path)) || undefined,
          }))
        )
      }

      return NextResponse.json({
        application: maskApplication(app),
        documents,
      })
    }

    const applications = await getCreditFundingApplications({ status, search })
    const masked = applications.map((a) => ({
      id: a.id,
      application_id: a.application_id,
      full_name: a.full_name,
      email: maskEmail(a.email),
      phone: maskPhone(a.phone),
      address: a.address,
      city: a.city,
      state: a.state,
      zip_code: a.zip_code,
      credit_goals: a.credit_goals,
      funding_goals: a.funding_goals,
      selected_credit_provider: a.selected_credit_provider,
      status: a.status,
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
    const { id, status } = body as { id?: string; status?: string }

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
    }

    if (!APPLICATION_STATUSES.includes(status as ApplicationStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const updated = await updateCreditFundingApplicationStatus(id, status as ApplicationStatus)
    if (!updated) {
      return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
    }

    logActivity({
      action: 'updated',
      entity_type: 'credit_funding_application',
      entity_id: id,
      actor_email: session.user.email || 'admin',
      details: `Status changed to ${status} for ${updated.application_id}`,
    })

    return NextResponse.json(maskApplication(updated))
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding PATCH', error)
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
  }
}
