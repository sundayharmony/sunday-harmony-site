import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { authOptions } from '@/lib/auth'
import { getMessages, createMessage, getClientById } from '@/lib/db'

export const dynamic = 'force-dynamic'

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')

  const messages = clientId ? await getMessages(clientId) : await getMessages()
  return NextResponse.json(messages)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { clientId, text } = await request.json()
  if (!clientId || !text?.trim()) {
    return NextResponse.json({ error: 'clientId and text required' }, { status: 400 })
  }

  const message = await createMessage({
    client_id: clientId,
    from_role: 'admin',
    from_name: session.user.name || 'Sunday Harmony',
    text: text.trim(),
  })

  // Send email notification to client (non-blocking)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const client = await getClientById(clientId)
      if (client?.email) {
        const siteUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        })

        transporter.sendMail({
          from: `"Sunday Harmony" <${process.env.SMTP_USER}>`,
          to: client.email,
          subject: `New message from Sunday Harmony`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
                New Message
              </h2>
              <p>Hi ${client.name.split(' ')[0]},</p>
              <p>You have a new message from the Sunday Harmony team:</p>
              <div style="padding:16px;background:#f8f6f0;border-radius:8px;margin:16px 0">
                <p style="margin:0;white-space:pre-wrap">${text.trim()}</p>
              </div>
              <div style="text-align:center;margin:24px 0">
                <a href="${siteUrl}/dashboard/messages" style="background:#c9a96e;color:#0a0a0f;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
                  View in Dashboard
                </a>
              </div>
              <p style="font-size:13px;color:#666;margin-top:20px;padding-top:15px;border-top:1px solid #eee">
                — Sunday Harmony
              </p>
            </div>
          `,
        }).catch(err => console.error('Failed to send message notification to client:', err))
      }
    } catch (err) {
      console.error('Client notification email setup failed:', err)
    }
  }

  return NextResponse.json(message)
}
