import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { isMarketingStaffRole, isStaffRole as isAnyStaffRole, isSalesRole, isContentRole } from '@/lib/staff-roles'

export { isStaffRole, isSalesRole, isContentRole } from '@/lib/staff-roles'

export type UserRole =
  | 'admin'
  | 'client'
  | 'credit_manager'
  | 'partner'
  | 'lead_procurement'
  | 'sales_closer'
  | 'client_relations'

export function isAdminRole(role?: string | null): boolean {
  return role === 'admin'
}

export function isCreditFundingStaffRole(role?: string | null): boolean {
  return role === 'admin' || role === 'credit_manager'
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

export function resolveAnyStaffAccess(
  session: { user?: { role?: string; sessionExpired?: boolean } } | null
): AccessResult {
  if (sessionHasEnded(session)) return { ok: false, status: 401, code: 'SESSION_EXPIRED' }
  if (!session?.user) return { ok: false, status: 401 }
  if (!isAnyStaffRole(session.user.role)) return { ok: false, status: 403 }
  return { ok: true }
}

export function resolveMarketingAccess(
  session: { user?: { role?: string; sessionExpired?: boolean } } | null
): AccessResult {
  if (sessionHasEnded(session)) return { ok: false, status: 401, code: 'SESSION_EXPIRED' }
  if (!session?.user) return { ok: false, status: 401 }
  if (!isAdminRole(session.user.role) && !isMarketingStaffRole(session.user.role)) {
    return { ok: false, status: 403 }
  }
  return { ok: true }
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

/** Admin, credit managers, and marketing roles. */
export async function requireAnyStaffSession(): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions)
  const access = resolveAnyStaffAccess(session)
  if (!access.ok) return forbiddenResponse(access.status, access.code)
  if (!isMarketingStaffRole(session?.user?.role) && !session?.user?.mfaVerified) {
    return NextResponse.json({ error: 'MFA required', code: 'MFA_REQUIRED' }, { status: 403 })
  }
  return session as Session
}

/** Admin or a marketing role — pipeline and client relations. */
export async function requireMarketingSession(): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions)
  const access = resolveMarketingAccess(session)
  if (!access.ok) return forbiddenResponse(access.status, access.code)
  if (!isMarketingStaffRole(session?.user?.role) && !session?.user?.mfaVerified) {
    return NextResponse.json({ error: 'MFA required', code: 'MFA_REQUIRED' }, { status: 403 })
  }
  return session as Session
}

/** Admin or sales roles (lead_procurement, sales_closer) — Sales Kit. */
export async function requireSalesSession(): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions)
  if (sessionHasEnded(session)) return forbiddenResponse(401, 'SESSION_EXPIRED')
  if (!session?.user) return forbiddenResponse(401)
  if (!isSalesRole(session.user.role)) return forbiddenResponse(403)
  // Sales marketing roles don't require MFA, admin does
  if (session.user.role === 'admin' && !session.user.mfaVerified) {
    return NextResponse.json({ error: 'MFA required', code: 'MFA_REQUIRED' }, { status: 403 })
  }
  return session as Session
}

/** Admin or content role (client_relations) — Content Kit. */
export async function requireContentSession(): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions)
  if (sessionHasEnded(session)) return forbiddenResponse(401, 'SESSION_EXPIRED')
  if (!session?.user) return forbiddenResponse(401)
  if (!isContentRole(session.user.role)) return forbiddenResponse(403)
  // Content marketing roles don't require MFA, admin does
  if (session.user.role === 'admin' && !session.user.mfaVerified) {
    return NextResponse.json({ error: 'MFA required', code: 'MFA_REQUIRED' }, { status: 403 })
  }
  return session as Session
}
