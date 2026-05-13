import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { getTasksByClient, createTask, updateTask, deleteTask, getClientById, createNotification } from '@/lib/db'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')

    if (!clientId) {
      return NextResponse.json([], { status: 200 })
    }

    const tasks = await getTasksByClient(clientId)
    return NextResponse.json(tasks, { status: 200 })
  } catch (error: unknown) {
    console.error('GET /api/admin/tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const body = await request.json()
    const { client_id, title, description, status, priority, due_date, category } = body

    if (!client_id || !title) {
      return NextResponse.json({ error: 'Missing required fields: client_id, title' }, { status: 400 })
    }

    // Input length validation
    if (typeof title === 'string' && title.length > 300) {
      return NextResponse.json({ error: 'Title is too long (max 300 characters)' }, { status: 400 })
    }
    if (typeof description === 'string' && description.length > 5000) {
      return NextResponse.json({ error: 'Description is too long (max 5000 characters)' }, { status: 400 })
    }

    const taskData = {
      client_id,
      title,
      description: description || '',
      status: status || 'not_started',
      priority: priority || 'medium',
      due_date: due_date || null,
      category: category || '',
    }

    const result = await createTask(taskData)
    if (!result) {
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }

    // Create notification for client
    const clientData = await getClientById(client_id)
    if (clientData) {
      // Find user with this client_id to send notification
      const { data: clientUser } = await (
        getSupabase().from('users').select('id').eq('client_id', client_id).single()
      )

      if (clientUser) {
        await createNotification({
          user_id: clientUser.id,
          title: 'New Task',
          message: title,
          type: 'task',
          link: '/dashboard/tasks',
        })
      }
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    console.error('POST /api/admin/tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing task id' }, { status: 400 })
    }

    const result = await updateTask(id, updates)
    if (!result) {
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error: unknown) {
    console.error('PUT /api/admin/tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing task id' }, { status: 400 })
    }

    const success = await deleteTask(id)
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Task deleted successfully' }, { status: 200 })
  } catch (error: unknown) {
    console.error('DELETE /api/admin/tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
