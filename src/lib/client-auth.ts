import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'

export type ClientSessionUser = Session['user'] & {
  role?: string
  clientId?: string
}

/** Returns a client session, or a JSON `NextResponse` with 401 / 403. */
export async function requireClientSession(): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'client') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const clientId = (session.user as ClientSessionUser).clientId
  if (!clientId) {
    return NextResponse.json({ error: 'Client account is not fully provisioned' }, { status: 403 })
  }
  return session
}

export function getClientIdFromSession(session: Session): string {
  return (session.user as ClientSessionUser).clientId || ''
}
