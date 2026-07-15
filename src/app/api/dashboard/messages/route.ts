import { NextResponse } from 'next/server'
import { getMessages, createMessage, getClientById } from '@/lib/db'
import {
  escHtml,
  getAdminNotifyEmail,
  getPublicSiteUrl,
  isEmailConfigured,
  sanitizeEmailSubjectPart,
  sendHtmlMailNonBlocking,
} from '@/lib/smtp-mail'
import { requireClientSession, getClientIdFromSession } from '@/lib/client-auth'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireClientSession()
  if (session instanceof NextResponse) return session

  const messages = await getMessages(getClientIdFromSession(session))
  return NextResponse.json(messages)
}

export async function POST(request: Request) {
  const session = await requireClientSession()
  if (session instanceof NextResponse) return session

  const rl = await rateLimitDurable(
    `dashboard-message:${session.user.id}`,
    30,
    15 * 60 * 1000
  )
  if (!rl.allowed) return rateLimitResponse(rl.resetIn)

  const clientId = getClientIdFromSession(session)
  const { text } = await request.json()
  if (!text?.trim()) {
    return NextResponse.json({ error: 'Message text required' }, { status: 400 })
  }

  if (typeof text === 'string' && text.length > 10000) {
    return NextResponse.json({ error: 'Message is too long (max 10000 characters)' }, { status: 400 })
  }

  const message = await createMessage({
    client_id: clientId,
    from_role: 'client',
    from_name: (session.user as { name?: string }).name || 'Client',
    text: text.trim(),
  })

  if (isEmailConfigured()) {
    try {
      const client = await getClientById(clientId)
      const siteUrl = getPublicSiteUrl()
      const fromName = (session.user as { name?: string }).name || 'a client'
      const subject = sanitizeEmailSubjectPart(
        `New message from ${fromName}${client ? ` (${client.business})` : ''}`,
        200
      )
      sendHtmlMailNonBlocking({
        to: getAdminNotifyEmail(),
        subject,
        html: `
          <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
              New Client Message
            </h2>
            <p><strong>From:</strong> ${escHtml((session.user as { name?: string }).name || 'Client')}${client ? ` &ndash; ${escHtml(client.business)}` : ''}</p>
            <div style="padding:16px;background:#f8f6f0;border-radius:8px;margin:12px 0">
              <p style="margin:0;white-space:pre-wrap">${escHtml(text.trim())}</p>
            </div>
            <p style="font-size:13px;color:#666">
              Reply from your <a href="${escHtml(siteUrl)}/admin/messages" style="color:#c9a96e">admin dashboard</a>.
            </p>
          </div>
        `,
        logLabel: 'client-message',
      })
    } catch (err) {
      console.error('Failed to send message notification:', err)
    }
  }

  return NextResponse.json(message)
}
