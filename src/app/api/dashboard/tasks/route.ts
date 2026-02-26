import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTasksByClient } from '@/lib/db'

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

    const tasks = await getTasksByClient(clientId)
    return NextResponse.json(tasks, { status: 200 })
  } catch (error: unknown) {
    console.error('GET /api/dashboard/tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
