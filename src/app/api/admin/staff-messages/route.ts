import { NextRequest, NextResponse } from 'next/server'
import { requireStaffSession } from '@/lib/stripe-admin-auth'
import { createStaffMessage, getStaffMessages, getStaffUsers } from '@/lib/db'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { escHtml, getPublicSiteUrl, isEmailConfigured, sendHtmlMailNonBlocking } from '@/lib/smtp-mail'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireStaffSession()
  if (session instanceof NextResponse) return session

  const messages = await getStaffMessages()
  return NextResponse.json(messages)
}

export async function POST(request: NextRequest) {
  const session = await requireStaffSession()
  if (session instanceof NextResponse) return session

  const ip = getClientIp(request)
  const rl = await rateLimitDurable(`staff-messages:${ip}`, 30, 15 * 60 * 1000)
  if (!rl.allowed) return rateLimitResponse(rl.resetIn)

  const { text } = await request.json()
  if (!text?.trim()) {
    return NextResponse.json({ error: 'Message text required' }, { status: 400 })
  }
  if (text.length > 10000) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 })
  }

  const userId = session.user.id
  if (!userId) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const message = await createStaffMessage({
    from_user_id: userId,
    text: text.trim(),
  })

  if (!message) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  const enriched = {
    ...message,
    from_name: session.user.name || 'Staff',
    from_role: session.user.role,
  }

  if (isEmailConfigured()) {
    const staff = await getStaffUsers()
    const senderEmail = session.user.email?.trim().toLowerCase()
    for (const member of staff) {
      if (member.email.toLowerCase() === senderEmail) continue
      sendHtmlMailNonBlocking({
        to: member.email,
        subject: 'New team message — Sunday Harmony',
        html: `
          <div style="font-family:'Montserrat',Arial,sans-serif;max-width:600px">
            <p><strong>${escHtml(session.user.name || 'A team member')}</strong> sent a message in Team Chat:</p>
            <div style="padding:12px;background:#f8f6f0;border-radius:8px;margin:12px 0;white-space:pre-wrap">${escHtml(text.trim())}</div>
            <p><a href="${escHtml(getPublicSiteUrl())}/admin/team-messages" style="color:#b8943f">Open Team Chat</a></p>
          </div>
        `,
        logLabel: 'staff-message-notify',
      })
    }
  }

  return NextResponse.json(enriched)
}
