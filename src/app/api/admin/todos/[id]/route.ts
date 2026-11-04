import { NextRequest, NextResponse } from 'next/server'
import { requireAnyStaffSession } from '@/lib/stripe-admin-auth'
import {
  deleteStaffTodo,
  getStaffTodo,
  isStaffTodoPriority,
  isStaffTodoStatus,
  updateStaffTodo,
  viewerCanAccessTodo,
  viewerCanEditTodo,
} from '@/lib/staff-todos'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAnyStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const todo = await getStaffTodo(id)
  if (!todo || !viewerCanAccessTodo(todo, { id: session.user.id, role: session.user.role })) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  return NextResponse.json({ todo })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAnyStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const existing = await getStaffTodo(id)
  if (!existing || !viewerCanEditTodo(existing, { id: session.user.id, role: session.user.role })) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (typeof body.title === 'string') updates.title = body.title
    if (typeof body.description === 'string') updates.description = body.description
    if (isStaffTodoPriority(body.priority)) updates.priority = body.priority
    if (isStaffTodoStatus(body.status)) updates.status = body.status
    if (body.due_date !== undefined) {
      updates.due_date = typeof body.due_date === 'string' ? body.due_date : null
    }

    // Only admins (or creators) can reassign
    if (body.assignee_id !== undefined) {
      const canReassign = session.user.role === 'admin' || existing.created_by === session.user.id
      if (!canReassign) {
        return NextResponse.json({ error: 'Only the creator or an admin can reassign' }, { status: 403 })
      }
      updates.assignee_id =
        typeof body.assignee_id === 'string' && body.assignee_id.trim()
          ? body.assignee_id.trim()
          : null
    }

    const todo = await updateStaffTodo(id, updates, {
      id: session.user.id,
      name: session.user.name,
    })

    if (!todo) {
      return NextResponse.json({ error: 'Failed to update todo' }, { status: 500 })
    }

    return NextResponse.json({ todo })
  } catch (err) {
    console.error('PATCH /api/admin/todos/[id] error:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAnyStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const existing = await getStaffTodo(id)
  if (!existing) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  const canDelete =
    session.user.role === 'admin' || existing.created_by === session.user.id
  if (!canDelete) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ok = await deleteStaffTodo(id)
  if (!ok) {
    return NextResponse.json({ error: 'Failed to delete todo' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
