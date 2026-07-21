import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { logActivity, getUserByEmail } from '@/lib/db'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import {
  cancelInvitationBackToDraft,
  convertDraftToInvitationPending,
  finalizeStaffDraftApplication,
  getCreditFundingApplicationById,
  getDocumentsByApplicationUuid,
  updateStaffDraftApplication,
} from '@/lib/credit-funding-db'
import { formatApplicationListItemForAdmin } from '@/lib/credit-funding-admin'
import {
  formatDraftForStaffEditor,
  mergeIntakePayloadWithExistingSecrets,
  type InviteSecretSetFlags,
} from '@/lib/credit-funding-sensitive-fields'
import { runCreditFundingSubmissionSideEffects } from '@/lib/credit-funding-finalize'
import {
  parseIntakePayload,
  validateDraftPayload,
  validateIntakePayload,
} from '@/lib/credit-funding-validation'
import {
  APPLICATION_INVITE_TTL_MS,
  buildApplicationInviteUrl,
} from '@/lib/credit-funding-invite'
import { sendCreditFundingApplicationInviteEmail } from '@/lib/credit-funding-applicant-onboarding'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { isUuid } from '@/lib/uuid'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

const NO_STORE = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
}

function parseKeepFlags(body: Record<string, unknown>): Partial<InviteSecretSetFlags> {
  const flag = (key: string) => body[key] === true || body[key] === 'true'
  return {
    ssnSet: flag('ssnSet'),
    dateOfBirthSet: flag('dateOfBirthSet'),
    providerUsernameSet: flag('providerUsernameSet'),
    providerPasswordSet: flag('providerPasswordSet'),
    experianEmailSet: flag('experianEmailSet'),
    experianPasswordSet: flag('experianPasswordSet'),
    cfpbEmailSet: flag('cfpbEmailSet'),
    cfpbPasswordSet: flag('cfpbPasswordSet'),
    typedSignatureSet: flag('typedSignatureSet'),
  }
}

function draftJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const { id } = await params
    if (!isUuid(id)) return draftJson({ error: 'Invalid draft id' }, 400)

    const app = await getCreditFundingApplicationById(id)
    if (!app || (app.status !== 'draft' && !(app.status === 'invitation_pending' && app.draft_source === 'staff_manual'))) {
      return draftJson({ error: 'Draft not found' }, 404)
    }

    const docs = await getDocumentsByApplicationUuid(app.id)
    return draftJson({
      ...formatApplicationListItemForAdmin(app),
      draft: formatDraftForStaffEditor(app),
      documents: docs.map((d) => ({
        id: d.id,
        document_type: d.document_type,
        file_name: d.file_name,
        file_size: d.file_size,
        scan_status: d.scan_status,
      })),
      editable: app.status === 'draft',
    })
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/drafts/[id] GET', error)
    return NextResponse.json({ error: 'Failed to load draft' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const staffEmail = session.user.email || 'admin'
    const rl = await rateLimitDurable(`cf-draft-save:${staffEmail}`, 60, 15 * 60 * 1000)
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const { id } = await params
    if (!isUuid(id)) return draftJson({ error: 'Invalid draft id' }, 400)

    const existing = await getCreditFundingApplicationById(id)
    if (!existing || existing.status !== 'draft') {
      return draftJson(
        { error: 'Only open drafts can be edited. Cancel the client finish link to resume editing.' },
        400
      )
    }

    const body = (await req.json()) as Record<string, unknown>
    let payload = parseIntakePayload(body)
    payload = mergeIntakePayloadWithExistingSecrets(payload, existing, parseKeepFlags(body))

    const validationError = validateDraftPayload(payload)
    if (validationError) {
      return draftJson({ error: validationError }, 400)
    }

    const updated = await updateStaffDraftApplication(id, payload)
    if (!updated) {
      return draftJson(
        { error: 'Failed to save draft. Another open application may already use this email.' },
        409
      )
    }

    logActivity({
      action: 'updated',
      entity_type: 'credit_funding_application',
      entity_id: updated.id,
      actor_email: staffEmail,
      details: `Updated staff draft ${updated.application_id}`,
    })

    return draftJson({
      ...formatApplicationListItemForAdmin(updated),
      draft: formatDraftForStaffEditor(updated),
      editable: true,
    })
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/drafts/[id] PATCH', error)
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const staffEmail = session.user.email || 'admin'
    const { id } = await params
    if (!isUuid(id)) return draftJson({ error: 'Invalid draft id' }, 400)

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = String(body.action || '').trim()

    const rl = await rateLimitDurable(`cf-draft-action:${staffEmail}`, 40, 15 * 60 * 1000)
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const existing = await getCreditFundingApplicationById(id)
    if (!existing) {
      return draftJson({ error: 'Application not found' }, 404)
    }

    if (action === 'finalize') {
      if (existing.status !== 'draft') {
        return draftJson({ error: 'Only open drafts can be finalized' }, 400)
      }

      let payload = parseIntakePayload(body)
      payload = mergeIntakePayloadWithExistingSecrets(payload, existing, parseKeepFlags(body))
      const validationError = validateIntakePayload(payload)
      if (validationError) {
        return draftJson({ error: validationError }, 400)
      }

      const docs = await getDocumentsByApplicationUuid(id)
      const hasPhotoId = docs.some((d) => d.document_type === 'photo_id' && d.scan_status !== 'rejected')
      const hasMailProof = docs.some((d) => d.document_type === 'mail_proof' && d.scan_status !== 'rejected')
      if (!hasPhotoId || !hasMailProof) {
        return draftJson(
          { error: 'Required documents missing: photo ID and mail proof must be uploaded before finalize.' },
          400
        )
      }

      const existingUser = await getUserByEmail(payload.email)
      const finalized = await finalizeStaffDraftApplication(
        id,
        payload,
        {
          userId: existingUser?.id,
          clientId: existing.client_id || existingUser?.client_id || undefined,
        },
        staffEmail
      )
      if (!finalized) {
        return draftJson({ error: 'Failed to finalize draft' }, 500)
      }

      await runCreditFundingSubmissionSideEffects({
        application: finalized,
        payload,
        actorEmail: staffEmail,
        activityDetails: `Staff finalized draft application: ${finalized.application_id}`,
      })

      return draftJson({
        success: true,
        applicationId: finalized.application_id,
        id: finalized.id,
        message: 'Draft finalized and submitted into the normal pipeline.',
      })
    }

    if (action === 'send-finish-link') {
      if (existing.status !== 'draft') {
        return draftJson({ error: 'Only open drafts can send a finish link' }, 400)
      }
      if (!existing.email || !existing.full_name) {
        return draftJson({ error: 'Draft needs a name and email before sending' }, 400)
      }

      const personalMessage =
        typeof body.personal_message === 'string' ? body.personal_message.slice(0, 2000) : undefined
      const inviteExpiresAt = new Date(Date.now() + APPLICATION_INVITE_TTL_MS)
      const updated = await convertDraftToInvitationPending(
        id,
        inviteExpiresAt,
        personalMessage,
        staffEmail
      )
      if (!updated) {
        return draftJson({ error: 'Failed to convert draft for client finish' }, 500)
      }

      await sendCreditFundingApplicationInviteEmail({
        to: updated.email,
        fullName: updated.full_name,
        inviteUrl: buildApplicationInviteUrl(updated.id, inviteExpiresAt.getTime()),
        personalMessage:
          personalMessage ||
          'Sunday Harmony started your Credit & Funding application. Please finish any remaining fields and submit.',
        staffName: session.user.name || 'Sunday Harmony Team',
      })

      logActivity({
        action: 'updated',
        entity_type: 'credit_funding_application',
        entity_id: updated.id,
        actor_email: staffEmail,
        details: `Sent finish link for draft ${updated.application_id} to ${updated.email}`,
      })

      return draftJson({
        success: true,
        ...formatApplicationListItemForAdmin(updated),
        expiresAt: inviteExpiresAt.toISOString(),
      })
    }

    if (action === 'cancel-finish-link') {
      if (existing.status !== 'invitation_pending' || existing.draft_source !== 'staff_manual') {
        return draftJson(
          { error: 'Only staff-draft invitations can be cancelled back to draft' },
          400
        )
      }

      const restored = await cancelInvitationBackToDraft(id, staffEmail)
      if (!restored) {
        return draftJson({ error: 'Failed to cancel finish link' }, 500)
      }

      logActivity({
        action: 'updated',
        entity_type: 'credit_funding_application',
        entity_id: restored.id,
        actor_email: staffEmail,
        details: `Cancelled finish link; restored draft ${restored.application_id}`,
      })

      return draftJson({
        ...formatApplicationListItemForAdmin(restored),
        draft: formatDraftForStaffEditor(restored),
        editable: true,
      })
    }

    return draftJson({ error: 'Unknown action' }, 400)
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/drafts/[id] POST', error)
    return NextResponse.json({ error: 'Draft action failed' }, { status: 500 })
  }
}
