import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'

export type UserRole = 'admin' | 'client' | 'credit_manager'

export function isAdminRole(role?: string | null): boolean {
  return role === 'admin'
}

export function isCreditFundingStaffRole(role?: string | null): boolean {
  return role === 'admin' || role === 'credit_manager'
}

export function isStaffRole(role?: string | null): boolean {
  return isCreditFundingStaffRole(role)
}

export function resolveAdminAccess(
  session: { user?: { role?: string } } | null
): { ok: true } | { ok: false; status: 401 | 403 } {
  if (!session?.user) return { ok: false, status: 401 }
  if (!isAdminRole(session.user.role)) return { ok: false, status: 403 }
  return { ok: true }
}

export function resolveCreditFundingStaffAccess(
  session: { user?: { role?: string } } | null
): { ok: true } | { ok: false; status: 401 | 403 } {
  if (!session?.user) return { ok: false, status: 401 }
  if (!isCreditFundingStaffRole(session.user.role)) return { ok: false, status: 403 }
  return { ok: true }
}

export function resolveStaffAccess(
  session: { user?: { role?: string } } | null
): { ok: true } | { ok: false; status: 401 | 403 } {
  return resolveCreditFundingStaffAccess(session)
}

function forbiddenResponse(status: 401 | 403): NextResponse {
  return NextResponse.json(
    { error: status === 401 ? 'Unauthorized' : 'Forbidden' },
    { status }
  )
}

/** Returns the admin session, or a JSON `NextResponse` with 401 / 403. */
export async function requireAdminSession(): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions)
  const access = resolveAdminAccess(session)
  if (!access.ok) return forbiddenResponse(access.status)
  if (!session?.user?.mfaVerified) {
    return NextResponse.json({ error: 'MFA required', code: 'MFA_REQUIRED' }, { status: 403 })
  }
  return session as Session
}

/** Admin or credit_manager — Credit & Funding panel APIs. */
export async function requireCreditFundingStaffSession(): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions)
  const access = resolveCreditFundingStaffAccess(session)
  if (!access.ok) return forbiddenResponse(access.status)
  if (!session?.user?.mfaVerified) {
    return NextResponse.json({ error: 'MFA required', code: 'MFA_REQUIRED' }, { status: 403 })
  }
  return session as Session
}

/** Admin or credit_manager — internal team chat APIs. */
export async function requireStaffSession(): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions)
  const access = resolveStaffAccess(session)
  if (!access.ok) return forbiddenResponse(access.status)
  if (!session?.user?.mfaVerified) {
    return NextResponse.json({ error: 'MFA required', code: 'MFA_REQUIRED' }, { status: 403 })
  }
  return session as Session
}
