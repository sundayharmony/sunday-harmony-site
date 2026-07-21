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
  decryptApplicationSensitiveFields,
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

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

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

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const { id } = await params
    const app = await getCreditFundingApplicationById(id)
    if (!app || (app.status !== 'draft' && !(app.status === 'invitation_pending' && app.draft_source === 'staff_manual'))) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    const docs = await getDocumentsByApplicationUuid(app.id)
    return NextResponse.json({
      ...formatApplicationListItemForAdmin(app),
      draft: decryptApplicationSensitiveFields(app),
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
    const { id } = await params
    const existing = await getCreditFundingApplicationById(id)
    if (!existing || existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only open drafts can be edited. Cancel the client finish link to resume editing.' },
        { status: 400 }
      )
    }

    const body = (await req.json()) as Record<string, unknown>
    let payload = parseIntakePayload(body)
    payload = mergeIntakePayloadWithExistingSecrets(payload, existing, parseKeepFlags(body))

    const validationError = validateDraftPayload(payload)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const updated = await updateStaffDraftApplication(id, payload)
    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to save draft. Another open application may already use this email.' },
        { status: 409 }
      )
    }

    logActivity({
      action: 'updated',
      entity_type: 'credit_funding_application',
      entity_id: updated.id,
      actor_email: staffEmail,
      details: `Updated staff draft ${updated.application_id}`,
    })

    return NextResponse.json({
      ...formatApplicationListItemForAdmin(updated),
      draft: decryptApplicationSensitiveFields(updated),
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
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = String(body.action || '').trim()

    const rl = await rateLimitDurable(`cf-draft-action:${staffEmail}`, 40, 15 * 60 * 1000)
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const existing = await getCreditFundingApplicationById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (action === 'finalize') {
      if (existing.status !== 'draft') {
        return NextResponse.json({ error: 'Only open drafts can be finalized' }, { status: 400 })
      }

      let payload = parseIntakePayload(body)
      payload = mergeIntakePayloadWithExistingSecrets(payload, existing, parseKeepFlags(body))
      const validationError = validateIntakePayload(payload)
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 })
      }

      const docs = await getDocumentsByApplicationUuid(id)
      const hasPhotoId = docs.some((d) => d.document_type === 'photo_id' && d.scan_status !== 'rejected')
      const hasMailProof = docs.some((d) => d.document_type === 'mail_proof' && d.scan_status !== 'rejected')
      if (!hasPhotoId || !hasMailProof) {
        return NextResponse.json(
          { error: 'Required documents missing: photo ID and mail proof must be uploaded before finalize.' },
          { status: 400 }
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
        return NextResponse.json({ error: 'Failed to finalize draft' }, { status: 500 })
      }

      await runCreditFundingSubmissionSideEffects({
        application: finalized,
        payload,
        actorEmail: staffEmail,
        activityDetails: `Staff finalized draft application: ${finalized.application_id}`,
      })

      return NextResponse.json({
        success: true,
        applicationId: finalized.application_id,
        id: finalized.id,
        message: 'Draft finalized and submitted into the normal pipeline.',
      })
    }

    if (action === 'send-finish-link') {
      if (existing.status !== 'draft') {
        return NextResponse.json({ error: 'Only open drafts can send a finish link' }, { status: 400 })
      }
      if (!existing.email || !existing.full_name) {
        return NextResponse.json({ error: 'Draft needs a name and email before sending' }, { status: 400 })
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
        return NextResponse.json({ error: 'Failed to convert draft for client finish' }, { status: 500 })
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

      return NextResponse.json({
        success: true,
        ...formatApplicationListItemForAdmin(updated),
        inviteUrl: buildApplicationInviteUrl(updated.id, inviteExpiresAt.getTime()),
        expiresAt: inviteExpiresAt.toISOString(),
      })
    }

    if (action === 'cancel-finish-link') {
      if (existing.status !== 'invitation_pending' || existing.draft_source !== 'staff_manual') {
        return NextResponse.json(
          { error: 'Only staff-draft invitations can be cancelled back to draft' },
          { status: 400 }
        )
      }

      const restored = await cancelInvitationBackToDraft(id, staffEmail)
      if (!restored) {
        return NextResponse.json({ error: 'Failed to cancel finish link' }, { status: 500 })
      }

      logActivity({
        action: 'updated',
        entity_type: 'credit_funding_application',
        entity_id: restored.id,
        actor_email: staffEmail,
        details: `Cancelled finish link; restored draft ${restored.application_id}`,
      })

      return NextResponse.json({
        ...formatApplicationListItemForAdmin(restored),
        draft: decryptApplicationSensitiveFields(restored),
        editable: true,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/drafts/[id] POST', error)
    return NextResponse.json({ error: 'Draft action failed' }, { status: 500 })
  }
}
