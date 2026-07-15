import { NextResponse } from 'next/server'
import { getMeetingsByClientId } from '@/lib/crm-db'
import { getClientIdFromSession, requireClientSession } from '@/lib/client-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireClientSession()
  if (session instanceof NextResponse) return session
  const clientId = getClientIdFromSession(session)

  const meetings = await getMeetingsByClientId(clientId)
  const now = Date.now()

  const upcoming = meetings.filter(
    (m) => m.status === 'scheduled' && new Date(m.scheduled_at).getTime() >= now
  )
  const previous = meetings.filter(
    (m) => m.status !== 'scheduled' || new Date(m.scheduled_at).getTime() < now
  )

  return NextResponse.json({ upcoming, previous })
}
