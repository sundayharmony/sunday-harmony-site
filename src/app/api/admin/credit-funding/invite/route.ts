import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { logActivity, getUserByEmail } from '@/lib/db'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import {
  createInvitedCreditFundingApplication,
  extendApplicationInvitation,
  getCreditFundingApplicationById,
} from '@/lib/credit-funding-db'
import { formatApplicationListItemForAdmin } from '@/lib/credit-funding-admin'
import { sendCreditFundingApplicationInviteEmail } from '@/lib/credit-funding-applicant-onboarding'
import {
  APPLICATION_INVITE_TTL_MS,
  buildApplicationInviteUrl,
} from '@/lib/credit-funding-invite'

export const dynamic = 'force-dynamic'

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function sendInviteForApplication(
  app: Awaited<ReturnType<typeof getCreditFundingApplicationById>>,
  staffEmail: string,
  staffName?: string
) {
  if (!app || app.status !== 'invitation_pending') {
    throw new Error('Application is not awaiting invitation')
  }

  const expiresAtMs = app.invite_expires_at
    ? new Date(app.invite_expires_at).getTime()
    : Date.now() + APPLICATION_INVITE_TTL_MS

  if (expiresAtMs <= Date.now()) {
    throw new Error('Invitation has expired — resend to issue a new link')
  }

  await sendCreditFundingApplicationInviteEmail({
    to: app.email,
    fullName: app.full_name,
    inviteUrl: buildApplicationInviteUrl(app.id, expiresAtMs),
    personalMessage: app.invite_personal_message || undefined,
    staffName: staffName || 'Sunday Harmony Team',
  })

  logActivity({
    action: 'updated',
    entity_type: 'credit_funding_application',
    entity_id: app.id,
    actor_email: staffEmail,
    details: `Sent Credit & Funding application invitation to ${app.email}`,
  })
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const body = await req.json()
    const { full_name, email, phone, client_id, personal_message } = body as {
      full_name?: string
      email?: string
      phone?: string
      client_id?: string
      personal_message?: string
    }

    if (!full_name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Client name and email are required' }, { status: 400 })
    }
    if (!validateEmail(email.trim())) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }
    if (personal_message && personal_message.length > 2000) {
      return NextResponse.json({ error: 'Personal message is too long (max 2000 characters)' }, { status: 400 })
    }

    const staffEmail = session.user.email || 'admin'
    const inviteExpiresAt = new Date(Date.now() + APPLICATION_INVITE_TTL_MS)

    const app = await createInvitedCreditFundingApplication({
      fullName: full_name,
      email,
      phone,
      clientId: client_id,
      invitedBy: staffEmail,
      personalMessage: personal_message,
      inviteExpiresAt,
    })

    if (!app) {
      return NextResponse.json(
        { error: 'This email already has a pending application invitation. Open it from the list or resend the invite.' },
        { status: 409 }
      )
    }

    if (client_id) {
      const linkedUser = await getUserByEmail(app.email)
      if (linkedUser && !linkedUser.client_id) {
        // client_id on application is enough for intake completion; user link happens on submit
      }
    }

    await sendInviteForApplication(app, staffEmail, session.user.name || undefined)

    return NextResponse.json(formatApplicationListItemForAdmin(app), { status: 201 })
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/invite POST', error)
    return NextResponse.json({ error: 'Failed to send application invitation' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const body = await req.json()
    const { id, personal_message } = body as { id?: string; personal_message?: string }

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const existing = await getCreditFundingApplicationById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }
    if (existing.status !== 'invitation_pending') {
      return NextResponse.json({ error: 'Only pending invitations can be resent' }, { status: 400 })
    }

    const inviteExpiresAt = new Date(Date.now() + APPLICATION_INVITE_TTL_MS)
    const updated = await extendApplicationInvitation(id, inviteExpiresAt, personal_message ?? existing.invite_personal_message ?? undefined)
    if (!updated) {
      return NextResponse.json({ error: 'Failed to refresh invitation' }, { status: 500 })
    }

    await sendInviteForApplication(updated, session.user.email || 'admin', session.user.name || undefined)

    return NextResponse.json(formatApplicationListItemForAdmin(updated))
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/invite PATCH', error)
    return NextResponse.json({ error: 'Failed to resend application invitation' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const id = new URL(req.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const app = await getCreditFundingApplicationById(id)
    if (!app || app.status !== 'invitation_pending') {
      return NextResponse.json({ error: 'Pending invitation not found' }, { status: 404 })
    }

    const expiresAtMs = app.invite_expires_at
      ? new Date(app.invite_expires_at).getTime()
      : Date.now() + APPLICATION_INVITE_TTL_MS

    return NextResponse.json({
      inviteUrl: buildApplicationInviteUrl(app.id, expiresAtMs),
      expiresAt: new Date(expiresAtMs).toISOString(),
    })
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/invite GET', error)
    return NextResponse.json({ error: 'Failed to build invite link' }, { status: 500 })
  }
}
