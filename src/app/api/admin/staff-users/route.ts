import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { createUser, getUserByEmail, logActivity } from '@/lib/db'
import { validatePassword } from '@/lib/auth-password'
import { getPublicSiteUrl, escHtml, isEmailConfigured, sendHtmlMailNonBlocking } from '@/lib/smtp-mail'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { getStaffUsers } = await import('@/lib/db')
  const staff = await getStaffUsers()
  return NextResponse.json(
    staff.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      created_at: u.created_at,
    }))
  )
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  const passwordError = validatePassword(password)
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 })
  }

  const existing = await getUserByEmail(email)
  if (existing) {
    return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
  }

  const user = await createUser({
    email,
    password,
    name,
    role: 'credit_manager',
  })

  if (!user) {
    return NextResponse.json({ error: 'Failed to create credit manager account' }, { status: 500 })
  }

  logActivity({
    action: 'created',
    entity_type: 'user',
    entity_id: user.id,
    actor_email: session.user.email || 'admin',
    details: `Created credit manager account for ${name} (${email})`,
  })

  if (isEmailConfigured()) {
    const siteUrl = getPublicSiteUrl()
    sendHtmlMailNonBlocking({
      to: email,
      subject: 'Your Sunday Harmony Credit Manager Access',
      html: `
        <div style="font-family:'Montserrat',Arial,sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#b8943f;border-bottom:2px solid #b8943f;padding-bottom:10px">Welcome, ${escHtml(name.split(' ')[0] || 'there')}</h2>
          <p style="color:#525252;line-height:1.6">You have been granted access to the Sunday Harmony Credit &amp; Funding panel and team messaging.</p>
          <p style="color:#525252;line-height:1.6">Sign in with your email at the link below. For security, passwords are never sent by email — use the password your administrator shared with you, or request a reset code.</p>
          <p style="margin:24px 0">
            <a href="${escHtml(siteUrl)}/login" style="display:inline-block;padding:12px 24px;background:#0a0a0a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Sign in</a>
          </p>
          <p style="font-size:12px;color:#888">Need a new password? <a href="${escHtml(siteUrl)}/forgot-password" style="color:#b8943f">Request a reset code</a></p>
        </div>
      `,
      logLabel: 'credit-manager-welcome',
    })
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  })
}
