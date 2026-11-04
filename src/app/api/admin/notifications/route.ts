import { NextRequest, NextResponse } from 'next/server'
import { requireAnyStaffSession } from '@/lib/stripe-admin-auth'
import {
  getNotificationById,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireAnyStaffSession()
  if (session instanceof NextResponse) return session

  const notifications = await getNotifications(session.user.id)
  return NextResponse.json(notifications)
}

export async function PUT(request: NextRequest) {
  const session = await requireAnyStaffSession()
  if (session instanceof NextResponse) return session

  try {
    const body = await request.json()
    const { id, all } = body

    if (all === true) {
      await markAllNotificationsRead(session.user.id)
      return NextResponse.json({ message: 'All notifications marked as read' })
    }

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing notification id or all flag' }, { status: 400 })
    }

    const notification = await getNotificationById(id)
    if (!notification || notification.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    await markNotificationRead(id)
    return NextResponse.json({ message: 'Notification marked as read' })
  } catch (err) {
    console.error('PUT /api/admin/notifications error:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
