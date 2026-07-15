import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { getDisputeSession } from '@/lib/dispute-letters/db'
import type { DisputeSessionListItem } from '@/lib/dispute-letters/types'

export async function requireDisputeSessionAccess(
  sessionId: string,
  adminSession: Session
): Promise<
  { ok: true; session: DisputeSessionListItem } |
  { ok: false; response: NextResponse }
> {
  const email = adminSession.user?.email
  if (!email) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const row = await getDisputeSession(sessionId, email)
  if (!row) {
    return { ok: false, response: NextResponse.json({ error: 'Session not found' }, { status: 404 }) }
  }
  return { ok: true, session: row }
}
