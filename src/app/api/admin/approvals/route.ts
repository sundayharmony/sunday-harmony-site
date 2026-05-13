import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { getApprovalsByClient, createApproval, updateApproval, createNotification } from '@/lib/db'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')

    if (!clientId) {
      return NextResponse.json({ error: 'Missing client_id query parameter' }, { status: 400 })
    }

    const approvals = await getApprovalsByClient(clientId)
    return NextResponse.json(approvals, { status: 200 })
  } catch (error: unknown) {
    console.error('GET /api/admin/approvals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const body = await request.json()
    const { client_id, title, description, content_type, content_url, content_text, admin_notes } = body

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
    if (typeof content_text === 'string' && content_text.length > 50000) {
      return NextResponse.json({ error: 'Content text is too long (max 50000 characters)' }, { status: 400 })
    }
    if (typeof admin_notes === 'string' && admin_notes.length > 5000) {
      return NextResponse.json({ error: 'Admin notes are too long (max 5000 characters)' }, { status: 400 })
    }

    const approvalData = {
      client_id,
      title,
      description: description || '',
      content_type: content_type || 'other',
      content_url: content_url || '',
      content_text: content_text || '',
      status: 'pending' as const,
      admin_notes: admin_notes || '',
      client_feedback: '',
    }

    const result = await createApproval(approvalData)
    if (!result) {
      return NextResponse.json({ error: 'Failed to create approval' }, { status: 500 })
    }

    // Create notification for client
    const clientUser = await getSupabase()
      .from('users')
      .select('id')
      .eq('client_id', client_id)
      .single()

    if (clientUser.data) {
      await createNotification({
        user_id: clientUser.data.id,
        title: 'Content Needs Approval',
        message: title,
        type: 'approval',
        link: '/dashboard/approvals',
      })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    console.error('POST /api/admin/approvals error:', error)
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
      return NextResponse.json({ error: 'Missing approval id' }, { status: 400 })
    }

    const result = await updateApproval(id, updates)
    if (!result) {
      return NextResponse.json({ error: 'Failed to update approval' }, { status: 500 })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error: unknown) {
    console.error('PUT /api/admin/approvals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
