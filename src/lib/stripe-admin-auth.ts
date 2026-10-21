import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { isStaffRole as isSharedStaffRole } from '@/lib/staff-roles'

export { isStaffRole } from '@/lib/staff-roles'

export type UserRole = 'admin' | 'client' | 'credit_manager' | 'partner'

export function isAdminRole(role?: string | null): boolean {
  return role === 'admin'
}

export function isCreditFundingStaffRole(role?: string | null): boolean {
  return isSharedStaffRole(role)
}

type AccessResult =
  | { ok: true }
  | { ok: false; status: 401 | 403; code?: 'SESSION_EXPIRED' }

function sessionHasEnded(session: { user?: { sessionExpired?: boolean } } | null): boolean {
  return Boolean(session?.user?.sessionExpired)
}

export function resolveAdminAccess(
  session: { user?: { role?: string; sessionExpired?: boolean } } | null
): AccessResult {
  if (sessionHasEnded(session)) return { ok: false, status: 401, code: 'SESSION_EXPIRED' }
  if (!session?.user) return { ok: false, status: 401 }
  if (!isAdminRole(session.user.role)) return { ok: false, status: 403 }
  return { ok: true }
}

export function resolveCreditFundingStaffAccess(
  session: { user?: { role?: string; sessionExpired?: boolean } } | null
): AccessResult {
  if (sessionHasEnded(session)) return { ok: false, status: 401, code: 'SESSION_EXPIRED' }
  if (!session?.user) return { ok: false, status: 401 }
  if (!isCreditFundingStaffRole(session.user.role)) return { ok: false, status: 403 }
  return { ok: true }
}

export function resolveStaffAccess(
  session: { user?: { role?: string; sessionExpired?: boolean } } | null
): AccessResult {
  return resolveCreditFundingStaffAccess(session)
}

function forbiddenResponse(status: 401 | 403, code?: 'SESSION_EXPIRED'): NextResponse {
  if (code === 'SESSION_EXPIRED') {
    return NextResponse.json(
      { error: 'Your session has ended. Sign in again.', code: 'SESSION_EXPIRED' },
      { status: 401 }
    )
  }
  return NextResponse.json(
    { error: status === 401 ? 'Unauthorized' : 'Forbidden' },
    { status }
  )
}

/** Returns the admin session, or a JSON `NextResponse` with 401 / 403. */
export async function requireAdminSession(): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions)
  const access = resolveAdminAccess(session)
  if (!access.ok) return forbiddenResponse(access.status, access.code)
  if (!session?.user?.mfaVerified) {
    return NextResponse.json({ error: 'MFA required', code: 'MFA_REQUIRED' }, { status: 403 })
  }
  return session as Session
}

/** Admin or credit_manager — Credit & Funding panel APIs. */
export async function requireCreditFundingStaffSession(): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions)
  const access = resolveCreditFundingStaffAccess(session)
  if (!access.ok) return forbiddenResponse(access.status, access.code)
  if (!session?.user?.mfaVerified) {
    return NextResponse.json({ error: 'MFA required', code: 'MFA_REQUIRED' }, { status: 403 })
  }
  return session as Session
}

/** Admin or credit_manager — shared staff APIs. */
export async function requireStaffSession(): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions)
  const access = resolveStaffAccess(session)
  if (!access.ok) return forbiddenResponse(access.status, access.code)
  if (!session?.user?.mfaVerified) {
    return NextResponse.json({ error: 'MFA required', code: 'MFA_REQUIRED' }, { status: 403 })
  }
  return session as Session
}
