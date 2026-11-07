import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { createNotification, getUserByEmail, logActivity } from '@/lib/db'
import { sendLetterIdentityDocumentRequestEmail } from '@/lib/credit-funding-applicant-onboarding'
import {
  createDocumentRequest,
  getCreditFundingApplicationById,
  getDocumentsByApplicationUuid,
  updateCreditFundingApplicationStatus,
} from '@/lib/credit-funding-db'
import { getCreditFundingDocumentSignedUrl } from '@/lib/credit-funding-storage'
import {
  isLetterWorkingCopyPath,
} from '@/lib/credit-funding-types'
import {
  LETTER_IDENTITY_REQUIREMENTS,
  letterDocsForRequirement,
  type LetterIdentityRequirementKey,
} from '@/lib/dispute-letters/letter-identity-attachments'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

function isIdentityImage(doc: { mime_type?: string | null; file_name?: string; file_type?: string | null }) {
  if ((doc.mime_type || '').startsWith('image/')) return true
  const ext = (doc.file_type || doc.file_name?.split('.').pop() || '').toLowerCase()
  return ['png', 'jpg', 'jpeg', 'webp'].includes(ext)
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const { id } = await params
    const access = await requireDisputeSessionAccess(id, session)
    if (!access.ok) return access.response

    const applicationUuid = access.session.application_uuid || null
    if (!applicationUuid) {
      return NextResponse.json({
        linked: false,
        applicationId: null,
        items: [],
      })
    }

    const docs = await getDocumentsByApplicationUuid(applicationUuid)
    const items = await Promise.all(
      LETTER_IDENTITY_REQUIREMENTS.map(async (requirement) => {
        const ofType = docs.filter(
          (doc) => requirement.types.includes(doc.document_type) && doc.scan_status !== 'rejected'
        )
        const originals = ofType.filter((doc) => !isLetterWorkingCopyPath(doc.storage_path))
        const copies = ofType.filter((doc) => isLetterWorkingCopyPath(doc.storage_path))
        const current = letterDocsForRequirement(docs, requirement)
        const withUrls = await Promise.all(
          [...originals, ...copies].map(async (doc) => ({
            id: doc.id,
            document_type: doc.document_type,
            file_name: doc.file_name,
            mime_type: doc.mime_type,
            file_type: doc.file_type,
            storage_path: doc.storage_path,
            scan_status: doc.scan_status,
            created_at: doc.created_at,
            letterCopy: isLetterWorkingCopyPath(doc.storage_path),
            canCrop: isIdentityImage(doc) && doc.scan_status !== 'rejected',
            signedUrl: (await getCreditFundingDocumentSignedUrl(doc.storage_path)) || undefined,
          }))
        )
        return {
          key: requirement.key,
          label: requirement.label,
          uploadType: requirement.uploadType,
          defaultRequestNote: requirement.defaultRequestNote,
          present: current.length > 0,
          documents: withUrls,
        }
      })
    )

    return NextResponse.json({
      linked: true,
      applicationId: applicationUuid,
      items,
    })
  } catch (error) {
    logApiRouteError(_req, 'admin/dispute-letters/[id]/letter-identity GET', error)
    return NextResponse.json({ error: 'Failed to load letter documents' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const { id } = await params
    const access = await requireDisputeSessionAccess(id, session)
    if (!access.ok) return access.response

    const applicationUuid = access.session.application_uuid
    if (!applicationUuid) {
      return NextResponse.json(
        { error: 'This report is not linked to a Credit & Funding application' },
        { status: 400 }
      )
    }

    const application = await getCreditFundingApplicationById(applicationUuid)
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      items?: { key?: string; notes?: string }[]
    }
    const requested = (body.items || [])
      .map((item) => {
        const requirement = LETTER_IDENTITY_REQUIREMENTS.find(
          (row) => row.key === (item.key as LetterIdentityRequirementKey)
        )
        if (!requirement) return null
        return {
          requirement,
          notes: (item.notes || requirement.defaultRequestNote).trim(),
        }
      })
      .filter((row): row is { requirement: (typeof LETTER_IDENTITY_REQUIREMENTS)[number]; notes: string } =>
        Boolean(row)
      )

    if (!requested.length) {
      return NextResponse.json({ error: 'Choose at least one missing document to request' }, { status: 400 })
    }

    const docs = await getDocumentsByApplicationUuid(applicationUuid)
    const toRequest = requested.filter(
      (row) => letterDocsForRequirement(docs, row.requirement).length === 0
    )
    if (!toRequest.length) {
      return NextResponse.json({ error: 'Those documents are already on file' }, { status: 400 })
    }

    const staffEmail = session.user.email || 'admin'
    for (const row of toRequest) {
      await createDocumentRequest({
        application_uuid: applicationUuid,
        document_type: row.requirement.uploadType,
        label: row.requirement.label,
        notes: row.notes,
        requested_by: staffEmail,
      })
    }

    if (application.status !== 'documents_pending' && application.status !== 'additional_information_requested') {
      await updateCreditFundingApplicationStatus(applicationUuid, 'documents_pending', {
        staffEmail,
        notes: `Letter documents requested: ${toRequest.map((row) => row.requirement.label).join(', ')}`,
      })
    }

    try {
      await sendLetterIdentityDocumentRequestEmail({
        to: application.email,
        applicationId: application.application_id,
        items: toRequest.map((row) => ({
          label: row.requirement.label,
          notes: row.notes,
        })),
      })
    } catch (err) {
      console.error('Failed to send letter identity document request email:', err)
    }

    if (application.user_id) {
      await createNotification({
        user_id: application.user_id,
        title: 'Document Requested',
        message: `Please upload: ${toRequest.map((row) => row.requirement.label).join(', ')}`,
        type: 'file',
        link: '/dashboard/credit-funding',
      })
    } else {
      const user = await getUserByEmail(application.email)
      if (user) {
        await createNotification({
          user_id: user.id,
          title: 'Document Requested',
          message: `Please upload: ${toRequest.map((row) => row.requirement.label).join(', ')}`,
          type: 'file',
          link: '/dashboard/credit-funding',
        })
      }
    }

    logActivity({
      action: 'updated',
      entity_type: 'credit_funding_application',
      entity_id: applicationUuid,
      actor_email: staffEmail,
      details: `Requested letter documents (${toRequest.map((row) => row.requirement.label).join(', ')}) for ${application.application_id}`,
    })

    return NextResponse.json({
      success: true,
      requested: toRequest.map((row) => row.requirement.key),
    })
  } catch (error) {
    logApiRouteError(req, 'admin/dispute-letters/[id]/letter-identity POST', error)
    return NextResponse.json({ error: 'Failed to send document request' }, { status: 500 })
  }
}
