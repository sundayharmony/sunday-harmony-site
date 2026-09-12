import { NextRequest, NextResponse } from 'next/server'
import { requireStaffSession } from '@/lib/stripe-admin-auth'
import {
  createStaffMessage,
  getStaffMessages,
  getStaffUsers,
  getUserByEmail,
  resolveStaffSenderId,
} from '@/lib/db'
import { isStaffRole } from '@/lib/staff-roles'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { escHtml, getPublicSiteUrl, isEmailConfigured, sendHtmlMailNonBlocking } from '@/lib/smtp-mail'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireStaffSession()
  if (session instanceof NextResponse) return session

  const result = await getStaffMessages()
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json(result.messages)
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
  if (typeof text === 'string' && text.length > 10000) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 })
  }

  let fromUserId = await resolveStaffSenderId({
    userId: session.user.id,
    email: session.user.email,
  })
  if (!fromUserId) {
    return NextResponse.json(
      { error: 'Your signed-in account is not linked to a staff user. Sign out and sign back in.' },
      { status: 400 }
    )
  }

  let result = await createStaffMessage({
    from_user_id: fromUserId,
    text: text.trim(),
  })

  if (!result.ok && result.status === 400 && session.user.email) {
    const byEmail = await getUserByEmail(session.user.email)
    if (byEmail && isStaffRole(byEmail.role) && byEmail.id !== fromUserId) {
      fromUserId = byEmail.id
      result = await createStaffMessage({
        from_user_id: fromUserId,
        text: text.trim(),
      })
    }
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const message = result.message
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
