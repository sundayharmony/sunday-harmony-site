import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logApiRouteError } from '@/lib/api-route-log'
import {
  getCreditFundingApplicationByEmail,
  getCreditFundingApplicationByUserId,
  createCreditFundingMessage,
  getCreditFundingMessages,
} from '@/lib/credit-funding-db'
import { getAdminNotifyEmail, sendHtmlMailNonBlocking, escHtml, sanitizeEmailSubjectPart, getPublicSiteUrl } from '@/lib/smtp-mail'

export const dynamic = 'force-dynamic'

async function resolveApplication(email: string, userId: string) {
  const byUser = await getCreditFundingApplicationByUserId(userId)
  if (byUser) return byUser
  return getCreditFundingApplicationByEmail(email)
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const application = await resolveApplication(session.user.email, session.user.id)
    if (!application) {
      return NextResponse.json({ error: 'No application found' }, { status: 404 })
    }

    const messages = await getCreditFundingMessages(application.id)
    return NextResponse.json(messages)
  } catch (error) {
    logApiRouteError({ url: '/api/dashboard/credit-funding/messages' } as NextRequest, 'dashboard/credit-funding/messages GET', error)
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { text } = await req.json()
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Message text required' }, { status: 400 })
    }
    if (text.length > 10000) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 })
    }

    const application = await resolveApplication(session.user.email, session.user.id)
    if (!application) {
      return NextResponse.json({ error: 'No application found' }, { status: 404 })
    }

    const message = await createCreditFundingMessage({
      application_uuid: application.id,
      from_role: 'applicant',
      from_name: session.user.name || application.full_name,
      from_email: session.user.email,
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
