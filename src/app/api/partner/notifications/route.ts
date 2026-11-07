import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import {
  getNotificationById,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/db'
import { requirePartnerSession } from '@/lib/partner-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await requirePartnerSession()
  if (session instanceof NextResponse) return session
  try {
    const notifications = await getNotifications(session.user.id)
    return NextResponse.json(notifications)
  } catch (error) {
    logApiRouteError(req, 'partner/notifications', error)
    return NextResponse.json({ error: 'Unable to load notifications.' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await requirePartnerSession()
  if (session instanceof NextResponse) return session
  try {
    const body = await req.json().catch(() => ({}))
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
  } catch (error) {
    logApiRouteError(req, 'partner/notifications', error)
    return NextResponse.json({ error: 'Unable to update notifications.' }, { status: 500 })
  }
}
