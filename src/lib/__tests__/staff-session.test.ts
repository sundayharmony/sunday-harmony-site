import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  STAFF_SESSION_MAX_AGE,
  isStaffSessionExpired,
  sessionCookieNamesToClear,
  stampStaffSessionStart,
} from '../staff-session'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

const NOW = 1_800_000_000

describe('staff session lifetime', () => {
  it('starts a fresh staff login at now and keeps an older stamp', () => {
    const fresh: { role: string; staffSessionStartedAt?: number } = { role: 'admin' }
    stampStaffSessionStart(fresh, true, NOW)
    assert.equal(fresh.staffSessionStartedAt, NOW)

    const legacy: { role: string; iat: number; staffSessionStartedAt?: number } = {
      role: 'credit_manager',
      iat: NOW - 100,
    }
    stampStaffSessionStart(legacy, false, NOW)
    assert.equal(legacy.staffSessionStartedAt, NOW - 100)
    stampStaffSessionStart(legacy, false, NOW + 50)
    assert.equal(legacy.staffSessionStartedAt, NOW - 100)
  })

  it('expires staff after 8 hours and leaves client sessions alone', () => {
    assert.equal(STAFF_SESSION_MAX_AGE, 8 * 60 * 60)
    assert.equal(
      isStaffSessionExpired({ role: 'admin', staffSessionStartedAt: NOW - STAFF_SESSION_MAX_AGE - 1 }, NOW),
      true
    )
    assert.equal(
      isStaffSessionExpired({ role: 'admin', staffSessionStartedAt: NOW - STAFF_SESSION_MAX_AGE }, NOW),
      false
    )
    assert.equal(isStaffSessionExpired({ role: 'admin', iat: NOW - STAFF_SESSION_MAX_AGE - 5 }, NOW), true)
    assert.equal(isStaffSessionExpired({ role: 'client', iat: NOW - STAFF_SESSION_MAX_AGE - 5 }, NOW), false)
  })

  it('clears chunked session cookies along with the standard names', () => {
    assert.deepEqual(sessionCookieNamesToClear(['__Secure-next-auth.session-token.0', 'other']), [
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      '__Secure-next-auth.session-token.0',
    ])
  })

  it('sends an ended staff session to login and keeps logout on screen', () => {
    const middleware = source('src/middleware.ts')
    assert.match(middleware, /isStaffSessionExpired/)
    assert.match(middleware, /clearSessionCookies/)
    assert.match(middleware, /maxAge: 0/)
    const auth = source('src/lib/auth.ts')
    assert.match(auth, /stampStaffSessionStart/)
    assert.match(auth, /sessionExpired: true/)
    assert.doesNotMatch(auth, / - iat > /)
    const gate = source('src/lib/stripe-admin-auth.ts')
    assert.match(gate, /SESSION_EXPIRED/)
    const shell = source('src/components/admin/AdminShell.tsx')
    assert.match(shell, /SESSION_EXPIRED/)
    assert.match(shell, /signOut\(\{ callbackUrl: '\/login' \}\)/)
    assert.match(shell, /refetchInterval=\{60\}/)
    const sidebar = source('src/components/admin/AdminSidebar.tsx')
    assert.match(sidebar, /h-dvh max-h-dvh/)
    assert.match(sidebar, />\s*Log out\s*</)
    assert.match(sidebar, /shrink-0 space-y-3/)
    assert.doesNotMatch(sidebar, /min-h-screen/)
    assert.match(source('src/components/admin/TodayBoard.tsx'), /SESSION_EXPIRED/)
    assert.match(source('src/components/dashboard/ClientSidebar.tsx'), /h-dvh max-h-dvh/)
    assert.match(source('src/components/dashboard/ClientSidebar.tsx'), />\s*Log out\s*</)
  })
})
