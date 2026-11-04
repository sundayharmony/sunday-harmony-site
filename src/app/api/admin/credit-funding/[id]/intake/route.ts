import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { logActivity } from '@/lib/db'
import { creditApplicationAccessDenied, viewerFromSession } from '@/lib/credit-expert-assignment'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import {
  getCreditFundingApplicationById,
  updateSubmittedApplicationIntake,
} from '@/lib/credit-funding-db'
import { formatApplicationListItemForAdmin } from '@/lib/credit-funding-admin'
import {
  formatDraftForStaffEditor,
  mergeIntakePayloadWithExistingSecrets,
  type InviteSecretSetFlags,
} from '@/lib/credit-funding-sensitive-fields'
import {
  parseIntakePayload,
  validateDraftPayload,
} from '@/lib/credit-funding-validation'
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
    experianSecurityAnswerSet: flag('experianSecurityAnswerSet'),
    experianPinSet: flag('experianPinSet'),
    cfpbEmailSet: flag('cfpbEmailSet'),
    cfpbPasswordSet: flag('cfpbPasswordSet'),
    typedSignatureSet: flag('typedSignatureSet'),
  }
}

function intakeJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

/** Admin-only: load intake editor payload for a submitted (non-draft) application. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const { id } = await params
    if (!isUuid(id)) return intakeJson({ error: 'Invalid application id' }, 400)

    const app = await getCreditFundingApplicationById(id)
    const denied = creditApplicationAccessDenied(viewerFromSession(session), app)
    if (denied) return denied
    if (!app || app.status === 'draft') {
      return intakeJson({ error: 'Application not found' }, 404)
    }

    return intakeJson({
      ...formatApplicationListItemForAdmin(app),
      draft: formatDraftForStaffEditor(app),
      editable: true,
      adminIntakeEdit: true,
    })
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/[id]/intake GET', error)
    return NextResponse.json({ error: 'Failed to load intake' }, { status: 500 })
  }
}

/** Admin-only: correct intake fields on a submitted application. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const staffEmail = session.user.email || 'admin'
    const rl = await rateLimitDurable(`cf-admin-intake-save:${staffEmail}`, 40, 15 * 60 * 1000)
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const { id } = await params
    if (!isUuid(id)) return intakeJson({ error: 'Invalid application id' }, 400)

    const existing = await getCreditFundingApplicationById(id)
    const denied = creditApplicationAccessDenied(viewerFromSession(session), existing)
    if (denied) return denied
    if (!existing || existing.status === 'draft') {
      return intakeJson(
        { error: 'Only submitted applications can be corrected here. Use the draft editor for drafts.' },
        400
      )
    }

    const body = (await req.json()) as Record<string, unknown>
    let payload = parseIntakePayload(body)
    payload = mergeIntakePayloadWithExistingSecrets(payload, existing, parseKeepFlags(body))

    const validationError = validateDraftPayload(payload)
    if (validationError) {
      return intakeJson({ error: validationError }, 400)
    }

    const updated = await updateSubmittedApplicationIntake(id, payload)
    if (!updated) {
      return intakeJson(
        { error: 'Failed to update intake. Another open application may already use this email.' },
        409
      )
    }

    logActivity({
      action: 'updated',
      entity_type: 'credit_funding_application',
      entity_id: updated.id,
      actor_email: staffEmail,
      details: `Admin corrected intake fields for ${updated.application_id} (status ${updated.status})`,
    })

    return intakeJson({
      ...formatApplicationListItemForAdmin(updated),
      draft: formatDraftForStaffEditor(updated),
      editable: true,
      adminIntakeEdit: true,
    })
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/[id]/intake PATCH', error)
    return NextResponse.json({ error: 'Failed to update intake' }, { status: 500 })
  }
}
