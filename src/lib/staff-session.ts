import { isStaffRole } from '@/lib/staff-roles'

/** Staff stay signed in for 8 hours from login. Clients keep the longer NextAuth max age. */
export const STAFF_SESSION_MAX_AGE = 8 * 60 * 60

export type StaffSessionStamp = {
  role?: string | null
  iat?: number
  staffSessionStartedAt?: number
}

export function stampStaffSessionStart(
  token: StaffSessionStamp,
  isFreshLogin: boolean,
  now = Math.floor(Date.now() / 1000)
) {
  if (!isStaffRole(token.role)) {
    delete token.staffSessionStartedAt
    return
  }
  if (isFreshLogin || typeof token.staffSessionStartedAt !== 'number') {
    token.staffSessionStartedAt = isFreshLogin || typeof token.iat !== 'number' ? now : token.iat
  }
}

/** True when this staff JWT is older than the staff lifetime. Client tokens are never expired here. */
export function isStaffSessionExpired(
  token: StaffSessionStamp,
  now = Math.floor(Date.now() / 1000)
): boolean {
  if (!isStaffRole(token.role) && typeof token.staffSessionStartedAt !== 'number') return false
  const started =
    typeof token.staffSessionStartedAt === 'number'
      ? token.staffSessionStartedAt
      : typeof token.iat === 'number'
        ? token.iat
        : null
  if (started == null) return false
  return now - started > STAFF_SESSION_MAX_AGE
}

export function sessionCookieNamesToClear(existingNames: string[]): string[] {
  const names = new Set<string>(['next-auth.session-token', '__Secure-next-auth.session-token'])
  for (const name of existingNames) {
    if (name.includes('session-token')) names.add(name)
  }
  return [...names]
}
