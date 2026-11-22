import { NextResponse } from 'next/server'
import { requireStaffSession } from '@/lib/stripe-admin-auth'
import { staffMayUseClient } from '@/lib/people-db'
import { getMessages, getFilesByClient, getClientById } from '@/lib/db'
import { escHtml, getPublicSiteUrl, isEmailConfigured } from '@/lib/smtp-mail'
import {
  notifyClientOfPortalMessage,
  queuePortalThreadEmail,
  savePortalMessage,
  syncPortalThreadIfAsked,
} from '@/lib/portal-message-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await requireStaffSession()
  if (session instanceof NextResponse) return session

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')?.trim()
  if (!clientId) return NextResponse.json({ messages: [], files: [] })
  if (!(await staffMayUseClient(session.user.role, clientId, session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await syncPortalThreadIfAsked(request, clientId)
  const [messages, files] = await Promise.all([getMessages(clientId), getFilesByClient(clientId)])
  return NextResponse.json({
    messages,
    files: files.map((file) => ({ id: file.id, name: file.name })),
  })
}

export async function POST(request: Request) {
  const session = await requireStaffSession()
  if (session instanceof NextResponse) return session

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'clientId and text required' }, { status: 400 })
  }
  const { clientId, text, fileId } = body as { clientId?: unknown; text?: unknown; fileId?: unknown }
  if (typeof clientId !== 'string' || !clientId.trim()) {
    return NextResponse.json({ error: 'clientId and text required' }, { status: 400 })
  }
  if (!(await staffMayUseClient(session.user.role, clientId, session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const saved = await savePortalMessage({
    clientId,
    fromRole: 'admin',
    fromName: session.user.name || 'Sunday Harmony',
    text,
    fileId,
  })
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status })

  await notifyClientOfPortalMessage(clientId, saved.message.text)

  if (isEmailConfigured()) {
    try {
      const client = await getClientById(clientId)
      if (client?.email) {
        const siteUrl = getPublicSiteUrl()
        queuePortalThreadEmail({
          to: client.email,
          subjectBase: 'New message from Sunday Harmony',
          clientId,
          attachment: saved.attachment,
          html: `
            <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
                New Message
              </h2>
              <p>Hi ${escHtml((client.name || 'there').split(' ')[0])},</p>
              <p>You have a new message from the Sunday Harmony team:</p>
              <div style="padding:16px;background:#f8f6f0;border-radius:8px;margin:16px 0">
                <p style="margin:0;white-space:pre-wrap">${escHtml(saved.message.text)}</p>
              </div>
              <div style="text-align:center;margin:24px 0">
                <a href="${escHtml(siteUrl)}/dashboard/messages" style="background:#c9a96e;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
                  View in Dashboard
                </a>
              </div>
              <p style="font-size:13px;color:#666">Reply from this email address and it will show on your portal thread.</p>
              <p style="font-size:13px;color:#666;margin-top:20px;padding-top:15px;border-top:1px solid #eee">
                &mdash; Sunday Harmony
              </p>
            </div>
          `,
        })
      }
    } catch (err) {
      console.error('Client notification email setup failed:', err)
    }
  }

  return NextResponse.json(saved.message)
}
