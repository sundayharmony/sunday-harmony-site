/** JWT / DB session generation used to invalidate tokens after a password change. */

/** How often the JWT callback re-reads the user row (ms). Between checks, trust the token. */
export const JWT_DB_CHECK_INTERVAL_MS = 5 * 60 * 1000

export function sessionVersionOf(
  user: { session_version?: number | null } | null | undefined
): number {
  const value = user?.session_version
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Fresh login always hits the DB. Later JWT refreshes only re-check when the
 * throttle window has elapsed (or lastDbCheckAt was never stamped).
 */
export function shouldRefreshUserFromDb(
  token: { lastDbCheckAt?: number },
  isFreshLogin: boolean,
  now = Date.now(),
  intervalMs = JWT_DB_CHECK_INTERVAL_MS
): boolean {
  if (isFreshLogin) return true
  const last = token.lastDbCheckAt
  if (typeof last !== 'number' || !Number.isFinite(last)) return true
  return now - last >= intervalMs
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
