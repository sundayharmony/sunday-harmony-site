import { NextRequest, NextResponse } from 'next/server'
import { requireClientSession } from '@/lib/client-auth'
import { getNotifications, markNotificationRead, markAllNotificationsRead, getNotificationById } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await requireClientSession()
    if (session instanceof NextResponse) return session
    const userId = session.user.id

    const notifications = await getNotifications(userId)
    return NextResponse.json(notifications, { status: 200 })
  } catch (error: unknown) {
    console.error('GET /api/dashboard/notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireClientSession()
    if (session instanceof NextResponse) return session
    const userId = session.user.id

    const body = await request.json()
    const { id, all } = body

    if (all === true) {
      await markAllNotificationsRead(userId)
      return NextResponse.json({ message: 'All notifications marked as read' }, { status: 200 })
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing notification id or all flag' }, { status: 400 })
    }

    // Verify notification belongs to this user before marking read (IDOR protection)
    const notification = await getNotificationById(id)
    if (!notification || notification.user_id !== userId) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    await markNotificationRead(id)
    return NextResponse.json({ message: 'Notification marked as read' }, { status: 200 })
  } catch (error: unknown) {
    console.error('PUT /api/dashboard/notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
