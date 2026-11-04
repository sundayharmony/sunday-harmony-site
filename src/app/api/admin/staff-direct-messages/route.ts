import { NextResponse } from 'next/server'
import { resolveStaffSenderId } from '@/lib/db'
import {
  getStaffDirectThread,
  listStaffDirectInbox,
  sendStaffDirectMessage,
} from '@/lib/staff-direct-messages-db'
import { STAFF_DIRECT_SETUP_ERROR } from '@/lib/staff-direct-messages'
import { requireAnyStaffSession } from '@/lib/stripe-admin-auth'
import { isSupabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function staffViewer(): Promise<{ id: string } | NextResponse> {
  const session = await requireAnyStaffSession()
  if (session instanceof NextResponse) return session
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: STAFF_DIRECT_SETUP_ERROR }, { status: 503 })
  }
  const id = await resolveStaffSenderId({
    userId: session.user.id,
    email: session.user.email,
  })
  if (!id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { id }
}

export async function GET(request: Request) {
  const viewer = await staffViewer()
  if (viewer instanceof NextResponse) return viewer

  const withId = new URL(request.url).searchParams.get('with')
  try {
    if (withId) {
      const result = await getStaffDirectThread(viewer.id, withId)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json(result.thread)
    }
    const result = await listStaffDirectInbox(viewer.id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result.inbox)
  } catch (error) {
    console.error('staff direct messages GET', error)
    return NextResponse.json({ error: STAFF_DIRECT_SETUP_ERROR }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const viewer = await staffViewer()
  if (viewer instanceof NextResponse) return viewer

  let body: { toUserId?: unknown; text?: unknown } | null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  }

  try {
    const result = await sendStaffDirectMessage(
      viewer.id,
      typeof body.toUserId === 'string' ? body.toUserId : '',
      body.text
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ message: result.message, colleagueId: result.colleagueId })
  } catch (error) {
    console.error('staff direct messages POST', error)
    return NextResponse.json({ error: STAFF_DIRECT_SETUP_ERROR }, { status: 503 })
  }
}
