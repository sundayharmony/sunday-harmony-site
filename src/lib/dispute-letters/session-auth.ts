import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { getDisputeSession, getDisputeSessionById } from '@/lib/dispute-letters/db'
import type { DisputeSessionListItem } from '@/lib/dispute-letters/types'

const STAFF_ROLES = new Set(['admin', 'owner', 'credit_manager'])

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

  const owned = await getDisputeSession(sessionId, email)
  if (owned) return { ok: true, session: owned }

  const role = adminSession.user?.role
  if (role && STAFF_ROLES.has(role)) {
    const row = await getDisputeSessionById(sessionId)
    if (row?.application_uuid) {
      return { ok: true, session: row }
    }
  }

  return { ok: false, response: NextResponse.json({ error: 'Session not found' }, { status: 404 }) }
}
