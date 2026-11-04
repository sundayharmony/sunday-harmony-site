import { NextRequest, NextResponse } from 'next/server'
import { isMarketingRole } from '@/lib/marketing-pipeline'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { createUser, getUserByEmail, logActivity } from '@/lib/db'
import { validatePassword } from '@/lib/auth-password'
import {
  generateTempPassword,
  issueAndSendCreditManagerSetupEmail,
} from '@/lib/credit-manager-onboarding'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { getStaffUsers } = await import('@/lib/db')
  const staff = await getStaffUsers()
  const team = new URL(req.url).searchParams.get('team')
  return NextResponse.json(
    staff
      .filter((u) => (team === 'marketing' ? isMarketingRole(u.role) : u.role === 'credit_manager'))
      .map((u) => ({
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

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  if (password) {
    const passwordError = validatePassword(password)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }
  }

  const existing = await getUserByEmail(email)
  if (existing) {
    return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
  }

  const requestedRole = typeof body.role === 'string' ? body.role : 'credit_manager'
  const role = isMarketingRole(requestedRole) ? requestedRole : 'credit_manager'
  const user = await createUser({
    email,
    password: password || generateTempPassword(),
    name,
    role,
  })

  if (!user) {
    return NextResponse.json({ error: 'Failed to create the staff account' }, { status: 500 })
  }

  logActivity({
    action: 'created',
    entity_type: 'user',
    entity_id: user.id,
    actor_email: session.user.email || 'admin',
    details: `Created ${role} account for ${name} (${email})`,
  })

  let emailSent = false
  try {
    const title = role === 'lead_procurement'
      ? 'Lead Procurement'
      : role === 'sales_closer'
        ? 'Sales Closer'
        : role === 'client_relations'
          ? 'Client Relations'
          : 'Credit Manager'
    const result = await issueAndSendCreditManagerSetupEmail(user, title)
    emailSent = result.emailSent
  } catch (err) {
    console.error('credit manager setup email error:', err)
    return NextResponse.json(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailSent: false,
        warning: 'Account created but setup email failed to send. Use Send setup email to retry.',
      },
      { status: 201 }
    )
  }

  return NextResponse.json(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailSent,
    },
    { status: 201 }
  )
}
