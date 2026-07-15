import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { logActivity } from '@/lib/db'
import {
  isCreditFundingRevealField,
  revealApplicationSensitiveField,
} from '@/lib/credit-funding-admin'
import { getCreditFundingApplicationById } from '@/lib/credit-funding-db'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const { id } = await context.params
    const body = await req.json().catch(() => ({}))
    const field = body.field
    if (!isCreditFundingRevealField(field)) {
      return NextResponse.json({ error: 'Invalid reveal field' }, { status: 400 })
    }

    const rl = await rateLimitDurable(
      `credit-funding-sensitive-reveal:${session.user.id}:${id}`,
      20,
      15 * 60 * 1000
    )
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const application = await getCreditFundingApplicationById(id)
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    logActivity({
      action: 'sensitive_field_revealed',
      entity_type: 'credit_funding_application',
      entity_id: id,
      actor_email: session.user.email || 'admin',
      details: `Revealed ${field} for ${application.application_id}`,
    })

    return NextResponse.json({
      field,
      value: revealApplicationSensitiveField(application, field),
    })
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/[id]/reveal-sensitive POST', error)
    return NextResponse.json({ error: 'Failed to reveal sensitive field' }, { status: 500 })
  }
}
