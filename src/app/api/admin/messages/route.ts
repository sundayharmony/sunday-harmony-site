import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { getMessages, createMessage, getClientById, createNotification } from '@/lib/db'
import { getSupabase } from '@/lib/supabase'
import { escHtml, getPublicSiteUrl, isEmailConfigured, sendHtmlMailNonBlocking } from '@/lib/smtp-mail'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')?.trim()
  if (!clientId) {
    return NextResponse.json([])
  }

  const messages = await getMessages(clientId)
  return NextResponse.json(messages)
}

export async function POST(request: Request) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { clientId, text } = await request.json()
  if (!clientId || !text?.trim()) {
    return NextResponse.json({ error: 'clientId and text required' }, { status: 400 })
  }

  // Input length validation
  if (typeof text === 'string' && text.length > 10000) {
    return NextResponse.json({ error: 'Message is too long (max 10000 characters)' }, { status: 400 })
  }

  const message = await createMessage({
    client_id: clientId,
    from_role: 'admin',
    from_name: session.user.name || 'Sunday Harmony',
    text: text.trim(),
  })

  // Create in-app notification for client
  const { data: clientUser } = await (
    getSupabase().from('users').select('id').eq('client_id', clientId).single()
  )

  if (clientUser) {
    await createNotification({
      user_id: clientUser.id,
      title: 'New Message',
      message: text.trim().substring(0, 50),
      type: 'message',
      link: '/dashboard/messages',
    })
  }

  if (isEmailConfigured()) {
    try {
      const client = await getClientById(clientId)
      if (client?.email) {
        const siteUrl = getPublicSiteUrl()
        const html = `
            <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
                New Message
              </h2>
              <p>Hi ${escHtml((client.name || 'there').split(' ')[0])},</p>
              <p>You have a new message from the Sunday Harmony team:</p>
              <div style="padding:16px;background:#f8f6f0;border-radius:8px;margin:16px 0">
                <p style="margin:0;white-space:pre-wrap">${escHtml(text.trim())}</p>
              </div>
              <div style="text-align:center;margin:24px 0">
                <a href="${escHtml(siteUrl)}/dashboard/messages" style="background:#c9a96e;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
                  View in Dashboard
                </a>
              </div>
              <p style="font-size:13px;color:#666;margin-top:20px;padding-top:15px;border-top:1px solid #eee">
                &mdash; Sunday Harmony
              </p>
            </div>
          `
        sendHtmlMailNonBlocking({
          to: client.email,
          subject: 'New message from Sunday Harmony',
          html,
          logLabel: 'admin-message-to-client',
        })
      }
    } catch (err) {
      console.error('Client notification email setup failed:', err)
    }
  }

  return NextResponse.json(message)
}
