/** JWT / DB session generation used to invalidate tokens after a password change. */

export function sessionVersionOf(
  user: { session_version?: number | null } | null | undefined
): number {
  const value = user?.session_version
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function nextSessionVersion(current: number | null | undefined): number {
  return sessionVersionOf({ session_version: current ?? 0 }) + 1
}

/**
 * Stamp `sessionVersion` on a fresh login or legacy token.
 * Invalidate when the DB generation no longer matches the JWT.
 */
export function applySessionVersionToToken(
  token: { sub?: unknown; sessionVersion?: number },
  dbVersion: number,
  isFreshLogin: boolean
): { invalidated: true } | { invalidated: false } {
  if (isFreshLogin || typeof token.sessionVersion !== 'number') {
    token.sessionVersion = dbVersion
    return { invalidated: false }
  }
  if (token.sessionVersion !== dbVersion) {
    return { invalidated: true }
  }
  return { invalidated: false }
}
