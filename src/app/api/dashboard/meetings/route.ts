import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMeetingsByClientId } from '@/lib/crm-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = (session.user as { clientId?: string }).clientId
  if (!clientId) {
    return NextResponse.json({ error: 'No client profile linked' }, { status: 403 })
  }

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
