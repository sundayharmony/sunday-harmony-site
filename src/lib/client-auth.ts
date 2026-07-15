import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { resolveClientAccess } from '@/lib/client-access'

export { resolveClientAccess } from '@/lib/client-access'

export type ClientSessionUser = Session['user'] & {
  role?: string
  clientId?: string
}

/** Returns a client session, or a JSON `NextResponse` with 401 / 403. */
export async function requireClientSession(): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions)
  const access = resolveClientAccess(session)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }
  return session as Session
}

export function getClientIdFromSession(session: Session): string {
  return (session.user as ClientSessionUser).clientId || ''
}
