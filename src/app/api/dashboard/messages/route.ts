import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { authOptions } from '@/lib/auth'
import { getMessages, createMessage, getClientById } from '@/lib/db'

export const dynamic = 'force-dynamic'

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

  const message = await createMessage({
    client_id: clientId,
    from_role: 'client',
    from_name: (session.user as { name?: string }).name || 'Client',
    text: text.trim(),
  })

  // Send email notification to admin (non-blocking)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const client = await getClientById(clientId)
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
      transporter.sendMail({
        from: `"Sunday Harmony" <${process.env.SMTP_USER}>`,
        to: process.env.NOTIFY_EMAIL || 'sales@sundayharmony.com',
        subject: `💬 New message from ${session.user.name || 'a client'}${client ? ` (${client.business})` : ''}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
              New Client Message
            </h2>
            <p><strong>From:</strong> ${(session.user as { name?: string }).name || 'Client'}${client ? ` — ${client.business}` : ''}</p>
            <div style="padding:16px;background:#f8f6f0;border-radius:8px;margin:12px 0">
              <p style="margin:0;white-space:pre-wrap">${text.trim()}</p>
            </div>
            <p style="font-size:13px;color:#666">
              Reply from your <a href="${process.env.NEXTAUTH_URL || ''}/admin/messages" style="color:#c9a96e">admin dashboard</a>.
            </p>
          </div>
        `,
      }).catch(err => console.error('Failed to send message notification:', err))
    } catch (err) {
      console.error('Email notification setup failed:', err)
    }
  }

  return NextResponse.json(message)
}
