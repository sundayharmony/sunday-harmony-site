import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { requireApplicantCreditFundingAccess } from '@/lib/credit-funding-dashboard-auth'
import {
  createCreditFundingMessage,
  getCreditFundingMessages,
} from '@/lib/credit-funding-db'
import { getAdminNotifyEmail, sendHtmlMailNonBlocking, escHtml, sanitizeEmailSubjectPart, getPublicSiteUrl } from '@/lib/smtp-mail'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const access = await requireApplicantCreditFundingAccess()
    if (!access.ok) return access.response

    const messages = await getCreditFundingMessages(access.application.id)
    return NextResponse.json(messages)
  } catch (error) {
    logApiRouteError({ url: '/api/dashboard/credit-funding/messages' } as NextRequest, 'dashboard/credit-funding/messages GET', error)
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireApplicantCreditFundingAccess()
    if (!access.ok) return access.response

    const { session, application } = access
    const rl = await rateLimitDurable(
      `dashboard-credit-funding-message:${session.user.id}`,
      30,
      15 * 60 * 1000
    )
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const { text } = await req.json()
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Message text required' }, { status: 400 })
    }
    if (text.length > 10000) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 })
    }

    const message = await createCreditFundingMessage({
      application_uuid: application.id,
      from_role: 'applicant',
      from_name: session.user.name || application.full_name,
      from_email: session.user.email || application.email,
      text: text.trim(),
    })

    if (!message) {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    sendHtmlMailNonBlocking({
      to: getAdminNotifyEmail(),
      subject: sanitizeEmailSubjectPart(
        `Credit Funding message — ${session.user.name || application.full_name}`,
        200
      ),
      html: `
        <p><strong>From:</strong> ${escHtml(session.user.name || application.full_name)} (${escHtml(application.application_id)})</p>
        <div style="padding:12px;background:#f8f6f0;border-radius:8px;margin:12px 0">
          <p style="margin:0;white-space:pre-wrap">${escHtml(text.trim())}</p>
        </div>
        <p><a href="${escHtml(getPublicSiteUrl())}/admin/credit-funding?id=${escHtml(application.id)}">View in admin</a></p>
      `,
      logLabel: 'cf-message-admin',
    })

    return NextResponse.json(message)
  } catch (error) {
    logApiRouteError(req, 'dashboard/credit-funding/messages POST', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
