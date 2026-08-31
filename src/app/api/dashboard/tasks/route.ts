import { NextRequest, NextResponse } from 'next/server'
import { getTasksByClient } from '@/lib/db'
import { requireClientSession, getClientIdFromSession } from '@/lib/client-auth'
import { attachFilesToTasks } from '@/lib/task-files'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await requireClientSession()
    if (session instanceof NextResponse) return session

    const tasks = await getTasksByClient(getClientIdFromSession(session))
    const withFiles = await attachFilesToTasks(tasks)
    return NextResponse.json(withFiles, { status: 200 })
  } catch (error: unknown) {
    console.error('GET /api/dashboard/tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
