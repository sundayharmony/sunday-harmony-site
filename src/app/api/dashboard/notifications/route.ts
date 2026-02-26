import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getNotifications, markNotificationRead, markAllNotificationsRead, getNotificationById } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { id: string }
    const userId = user.id

    const notifications = await getNotifications(userId)
    return NextResponse.json(notifications, { status: 200 })
  } catch (error: unknown) {
    console.error('GET /api/dashboard/notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { id: string }
    const userId = user.id

    const body = await request.json()
    const { id, all } = body

    if (all === true) {
      await markAllNotificationsRead(userId)
      return NextResponse.json({ message: 'All notifications marked as read' }, { status: 200 })
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing notification id or all flag' }, { status: 400 })
    }

    await markNotificationRead(id)
    return NextResponse.json({ message: 'Notification marked as read' }, { status: 200 })
  } catch (error: unknown) {
    console.error('PUT /api/dashboard/notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
