import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { getClientById } from '@/lib/db'
import { salesCloserOwnsClient } from '@/lib/marketing-crm'

export type BillingAuth = {
  clientId: string
  /** Staff acting on a client file. True for admin and for a closer billing their own marketing client. */
  isAdmin: boolean
  actorEmail: string
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/**
 * Admin must pass clientId and finish MFA.
 * A sales closer may bill only an Active marketing client linked to a deal they can see, with no MFA.
 * Clients use their linked profile only.
 */
export async function authorizeBillingClient(
  requestedClientId?: string
): Promise<BillingAuth | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.sessionExpired) {
    return unauthorized()
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

  if (session.user.role === 'sales_closer') {
    const clientId = requestedClientId?.trim()
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }
    if (!(await salesCloserOwnsClient(clientId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

/** Admin (with MFA) or the closer who owns this marketing client. */
export async function requireMarketingBillingSession(
  clientId: string
): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.sessionExpired) return unauthorized()
  const id = clientId.trim()
  if (!id) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })

  if (session.user.role === 'admin') {
    if (!session.user.mfaVerified) {
      return NextResponse.json({ error: 'MFA verification required' }, { status: 403 })
    }
    const client = await getClientById(id)
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    return session
  }

  if (session.user.role === 'sales_closer') {
    if (!(await salesCloserOwnsClient(id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return session
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
