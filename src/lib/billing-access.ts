import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { getClientById } from '@/lib/db'

export type BillingAuth = {
  clientId: string
  isAdmin: boolean
  actorEmail: string
}

/** Admin must pass clientId; clients use their linked profile only. */
export async function authorizeBillingClient(
  requestedClientId?: string
): Promise<BillingAuth | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const actorEmail = session.user.email || 'user'

  if (session.user.role === 'admin') {
    if (!session.user.mfaVerified) {
      return NextResponse.json({ error: 'MFA verification required' }, { status: 403 })
    }
    const clientId = requestedClientId?.trim()
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }
    const client = await getClientById(clientId)
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    return { clientId, isAdmin: true, actorEmail }
  }

  if (session.user.role === 'client') {
    const clientId = session.user.clientId
    if (!clientId) {
      return NextResponse.json({ error: 'No client profile linked' }, { status: 404 })
    }
    if (requestedClientId && requestedClientId !== clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const client = await getClientById(clientId)
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    return { clientId, isAdmin: false, actorEmail }
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
