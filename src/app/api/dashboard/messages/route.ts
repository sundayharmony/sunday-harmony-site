import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { getMessages, createMessage, getClientById } from '@/lib/db'
import { createEmailTransporter, getAdminNotifyEmail, getPublicSiteUrl, isSmtpConfigured, sanitizeEmailSubjectPart } from '@/lib/smtp-mail'

export const dynamic = 'force-dynamic'

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as { role?: string }).role
  if (userRole !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = (session.user as { clientId?: string }).clientId
  if (!clientId) {
    return NextResponse.json([])
  }

  const messages = await getMessages(clientId)
  return NextResponse.json(messages)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as { role?: string }).role
  if (userRole !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = (session.user as { clientId?: string }).clientId
  if (!clientId) {
    return NextResponse.json({ error: 'No client profile linked' }, { status: 400 })
  }

  const { text } = await request.json()
  if (!text?.trim()) {
    return NextResponse.json({ error: 'Message text required' }, { status: 400 })
  }

  // Input length validation
  if (typeof text === 'string' && text.length > 10000) {
    return NextResponse.json({ error: 'Message is too long (max 10000 characters)' }, { status: 400 })
  }

  const message = await createMessage({
    client_id: clientId,
    from_role: 'client',
    from_name: (session.user as { name?: string }).name || 'Client',
    text: text.trim(),
  })

  // Send email notification to admin (non-blocking)
  if (isSmtpConfigured()) {
    try {
      const client = await getClientById(clientId)
      const transporter = createEmailTransporter()
      const siteUrl = getPublicSiteUrl()
      const fromName = (session.user as { name?: string }).name || 'a client'
      const subject = sanitizeEmailSubjectPart(
        `New message from ${fromName}${client ? ` (${client.business})` : ''}`,
        200
      )
      transporter.sendMail({
        from: `"Sunday Harmony" <${process.env.SMTP_USER}>`,
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
      }).catch(err => console.error('Failed to send message notification:', err))
    } catch (err) {
      console.error('Failed to send message notification:', err)
    }
  }

  return NextResponse.json(message)
}
