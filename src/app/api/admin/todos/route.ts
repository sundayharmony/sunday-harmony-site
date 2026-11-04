import { NextRequest, NextResponse } from 'next/server'
import { requireAnyStaffSession } from '@/lib/stripe-admin-auth'
import {
  createStaffTodo,
  isStaffTodoPriority,
  isStaffTodoStatus,
  listStaffTodos,
  type StaffTodoStatus,
} from '@/lib/staff-todos'
import { getStaffUsers } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await requireAnyStaffSession()
  if (session instanceof NextResponse) return session

  const { searchParams } = new URL(request.url)
  if (searchParams.get('view') === 'assignees') {
    const staff = await getStaffUsers()
    return NextResponse.json({
      assignees: staff.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      })),
    })
  }

  const statusParam = searchParams.get('status') || 'all'
  const status =
    statusParam === 'all' || isStaffTodoStatus(statusParam)
      ? (statusParam as StaffTodoStatus | 'all')
      : 'all'
  const assigneeId = searchParams.get('assignee') || 'all'

  const todos = await listStaffTodos({
    viewerId: session.user.id,
    viewerRole: session.user.role,
    status,
    assigneeId,
  })

  return NextResponse.json({ todos })
}

export async function POST(request: NextRequest) {
  const session = await requireAnyStaffSession()
  if (session instanceof NextResponse) return session

  try {
    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const priority = isStaffTodoPriority(body.priority) ? body.priority : 'medium'
    const status = isStaffTodoStatus(body.status) ? body.status : 'open'
    const assigneeId =
      typeof body.assignee_id === 'string' && body.assignee_id.trim()
        ? body.assignee_id.trim()
        : null

    const todo = await createStaffTodo({
      title,
      description: typeof body.description === 'string' ? body.description : '',
      priority,
      status,
      due_date: typeof body.due_date === 'string' ? body.due_date : null,
      assignee_id: assigneeId,
      created_by: session.user.id,
    })

    if (!todo) {
      return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 })
    }

    return NextResponse.json({ todo }, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/todos error:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
