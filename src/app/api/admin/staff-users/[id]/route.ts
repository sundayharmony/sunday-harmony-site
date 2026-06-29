import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { deleteUser, getUserByEmail, getUserById, logActivity, updateUser } from '@/lib/db'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { id } = await context.params
  const user = await getUserById(id)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (user.role !== 'credit_manager') {
    return NextResponse.json({ error: 'Only credit manager accounts can be edited here' }, { status: 403 })
  }

  const body = await req.json()
  const name = typeof body.name === 'string' ? body.name.trim() : user.name
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : user.email

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  if (email !== user.email) {
    const existing = await getUserByEmail(email)
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }
  }

  const updated = await updateUser(id, { name, email })
  if (!updated) {
    return NextResponse.json({ error: 'Failed to update credit expert' }, { status: 500 })
  }

  logActivity({
    action: 'updated',
    entity_type: 'user',
    entity_id: id,
    actor_email: session.user.email || 'admin',
    details: `Updated credit manager ${name} (${email})`,
  })

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    created_at: updated.created_at,
  })
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { id } = await context.params
  const user = await getUserById(id)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (user.role !== 'credit_manager') {
    return NextResponse.json({ error: 'Only credit manager accounts can be removed here' }, { status: 403 })
  }

  const ok = await deleteUser(id)
  if (!ok) {
    return NextResponse.json({ error: 'Failed to remove credit expert' }, { status: 500 })
  }

  logActivity({
    action: 'deleted',
    entity_type: 'user',
    entity_id: id,
    actor_email: session.user.email || 'admin',
    details: `Removed credit manager ${user.name} (${user.email})`,
  })

  return NextResponse.json({ success: true })
}
