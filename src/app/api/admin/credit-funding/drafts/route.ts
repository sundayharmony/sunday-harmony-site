import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { logActivity } from '@/lib/db'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import {
  createStaffDraftApplication,
  getBlockingIncompleteApplicationByEmail,
} from '@/lib/credit-funding-db'
import { formatApplicationListItemForAdmin } from '@/lib/credit-funding-admin'
import { formatDraftForStaffEditor } from '@/lib/credit-funding-sensitive-fields'
import {
  parseIntakePayload,
  validateDraftPayload,
} from '@/lib/credit-funding-validation'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { isUuid } from '@/lib/uuid'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const staffEmail = session.user.email || 'admin'
    const rl = await rateLimitDurable(`cf-draft-create:${staffEmail}`, 30, 15 * 60 * 1000)
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const body = (await req.json()) as Record<string, unknown>
    const payload = parseIntakePayload(body)
    const validationError = validateDraftPayload(payload)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400, headers: NO_STORE })
    }

    const clientIdRaw = typeof body.client_id === 'string' ? body.client_id.trim() : ''
    if (clientIdRaw && !isUuid(clientIdRaw)) {
      return NextResponse.json({ error: 'Invalid client_id' }, { status: 400, headers: NO_STORE })
    }

    const blocking = await getBlockingIncompleteApplicationByEmail(payload.email)
    if (blocking) {
      return NextResponse.json(
        {
          error:
            blocking.status === 'draft'
              ? 'An open draft already exists for this email. Open it from the list to continue.'
              : 'This email already has a pending invitation. Open it from the list or cancel it first.',
          existingId: blocking.id,
          existingStatus: blocking.status,
        },
        { status: 409, headers: NO_STORE }
      )
    }

    const app = await createStaffDraftApplication({
      payload,
      staffEmail,
      clientId: clientIdRaw || undefined,
    })

    if (!app) {
      return NextResponse.json({ error: 'Failed to create draft application' }, { status: 500, headers: NO_STORE })
    }

    logActivity({
      action: 'created',
      entity_type: 'credit_funding_application',
      entity_id: app.id,
      actor_email: staffEmail,
      details: `Created staff draft ${app.application_id} for ${app.email}`,
    })

    return NextResponse.json(
      {
        ...formatApplicationListItemForAdmin(app),
        draft: formatDraftForStaffEditor(app),
      },
      { status: 201, headers: NO_STORE }
    )
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/drafts POST', error)
    return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 })
  }
}
