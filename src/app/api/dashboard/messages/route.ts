import { NextResponse } from 'next/server'
import { getMessages, getFilesByClient, getClientById } from '@/lib/db'
import { escHtml, getAdminNotifyEmail, getPublicSiteUrl, isEmailConfigured } from '@/lib/smtp-mail'
import { requireClientSession, getClientIdFromSession } from '@/lib/client-auth'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { queuePortalThreadEmail, savePortalMessage, syncPortalThreadIfAsked } from '@/lib/portal-message-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await requireClientSession()
  if (session instanceof NextResponse) return session

  const clientId = getClientIdFromSession(session)
  await syncPortalThreadIfAsked(request, clientId)
  const [messages, files] = await Promise.all([getMessages(clientId), getFilesByClient(clientId)])
  return NextResponse.json({
    messages,
    files: files.map((file) => ({ id: file.id, name: file.name })),
  })
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
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Message text required' }, { status: 400 })
  }
  const { text, fileId } = body as { text?: unknown; fileId?: unknown }
  const saved = await savePortalMessage({
    clientId,
    fromRole: 'client',
    fromName: (session.user as { name?: string }).name || 'Client',
    text,
    fileId,
  })
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status })

  if (isEmailConfigured()) {
    try {
      const client = await getClientById(clientId)
      const siteUrl = getPublicSiteUrl()
      const fromName = (session.user as { name?: string }).name || 'a client'
      queuePortalThreadEmail({
        to: getAdminNotifyEmail(),
        subjectBase: `New message from ${fromName}${client ? ` (${client.business})` : ''}`,
        clientId,
        attachment: saved.attachment,
        html: `
          <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
              New Client Message
            </h2>
            <p><strong>From:</strong> ${escHtml((session.user as { name?: string }).name || 'Client')}${client ? ` &ndash; ${escHtml(client.business)}` : ''}</p>
            <div style="padding:16px;background:#f8f6f0;border-radius:8px;margin:12px 0">
              <p style="margin:0;white-space:pre-wrap">${escHtml(saved.message.text)}</p>
            </div>
            <p style="font-size:13px;color:#666">
              Reply to this email or from your <a href="${escHtml(siteUrl)}/admin/people/${escHtml(clientId)}" style="color:#c9a96e">admin dashboard</a>.
            </p>
          </div>
        `,
      })
    } catch (err) {
      console.error('Failed to send message notification:', err)
    }
  }

  return NextResponse.json(saved.message)
}
