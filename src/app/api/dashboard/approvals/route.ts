import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getApprovalsByClient, updateApproval } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { role?: string; clientId?: string }
    if (user.role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const clientId = user.clientId
    if (!clientId) {
      return NextResponse.json({ error: 'No client ID associated with user' }, { status: 400 })
    }

    const approvals = await getApprovalsByClient(clientId)
    return NextResponse.json(approvals, { status: 200 })
  } catch (error: any) {
    console.error('GET /api/dashboard/approvals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { role?: string; clientId?: string }
    if (user.role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, status, client_feedback } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing approval id' }, { status: 400 })
    }

    if (!status || !['approved', 'revision_requested'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "approved" or "revision_requested"' },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = { status }
    if (client_feedback !== undefined) updates.client_feedback = client_feedback

    const result = await updateApproval(id, updates)
    if (!result) {
      return NextResponse.json({ error: 'Failed to update approval' }, { status: 500 })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error('PUT /api/dashboard/approvals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
