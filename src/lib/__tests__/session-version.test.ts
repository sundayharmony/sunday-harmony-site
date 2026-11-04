import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  applySessionVersionToToken,
  JWT_DB_CHECK_INTERVAL_MS,
  nextSessionVersion,
  sessionVersionOf,
  shouldRefreshUserFromDb,
} from '../session-version'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('sessionVersion helpers', () => {
  it('treats missing or non-numeric versions as 0', () => {
    assert.equal(sessionVersionOf(undefined), 0)
    assert.equal(sessionVersionOf({}), 0)
    assert.equal(sessionVersionOf({ session_version: null }), 0)
    assert.equal(sessionVersionOf({ session_version: 4 }), 4)
  })

  it('increments from the current generation', () => {
    assert.equal(nextSessionVersion(undefined), 1)
    assert.equal(nextSessionVersion(0), 1)
    assert.equal(nextSessionVersion(7), 8)
  })

  it('stamps the DB version on fresh login and legacy tokens', () => {
    const fresh: { sub: string; sessionVersion?: number } = { sub: 'user-1' }
    assert.deepEqual(applySessionVersionToToken(fresh, 3, true), { invalidated: false })
    assert.equal(fresh.sessionVersion, 3)

    const legacy: { sub: string; sessionVersion?: number } = { sub: 'user-1' }
    assert.deepEqual(applySessionVersionToToken(legacy, 2, false), { invalidated: false })
    assert.equal(legacy.sessionVersion, 2)
  })

  it('invalidates JWTs whose generation no longer matches the database', () => {
    const token = { sub: 'user-1', sessionVersion: 1 }
    assert.deepEqual(applySessionVersionToToken(token, 2, false), { invalidated: true })
    assert.equal(token.sessionVersion, 1)
  })

  it('keeps JWTs that still match the database generation', () => {
    const token = { sub: 'user-1', sessionVersion: 2 }
    assert.deepEqual(applySessionVersionToToken(token, 2, false), { invalidated: false })
    assert.equal(token.sessionVersion, 2)
  })
})

describe('JWT DB refresh throttle', () => {
  it('always refreshes on fresh login', () => {
    assert.equal(shouldRefreshUserFromDb({ lastDbCheckAt: Date.now() }, true), true)
  })

  it('refreshes when lastDbCheckAt is missing', () => {
    assert.equal(shouldRefreshUserFromDb({}, false), true)
  })

  it('skips DB when the throttle window has not elapsed', () => {
    const now = 1_700_000_000_000
    assert.equal(
      shouldRefreshUserFromDb({ lastDbCheckAt: now - 60_000 }, false, now),
      false
    )
  })

  it('refreshes when the throttle window has elapsed', () => {
    const now = 1_700_000_000_000
    assert.equal(
      shouldRefreshUserFromDb(
        { lastDbCheckAt: now - JWT_DB_CHECK_INTERVAL_MS },
        false,
        now
      ),
      true
    )
  })

  it('wires throttle into auth jwt callback and dials back admin session polling', () => {
    const auth = source('src/lib/auth.ts')
    const shell = source('src/components/admin/AdminShell.tsx')
    assert.match(auth, /shouldRefreshUserFromDb/)
    assert.match(auth, /lastDbCheckAt/)
    assert.match(shell, /refetchInterval=\{0\}/)
    assert.match(shell, /refetchOnWindowFocus=\{false\}/)
  })
})

describe('password changes bump session_version', () => {
  it('increments session_version in updateUser and reset-password', () => {
    const db = source('src/lib/db.ts')
    const reset = source('src/app/api/auth/reset-password/route.ts')
    const auth = source('src/lib/auth.ts')
    const migration = source('supabase-migration-031-session-version.sql')

    assert.match(db, /payload\.session_version = nextSessionVersion/)
    assert.match(reset, /session_version: nextSessionVersion/)
    assert.match(auth, /applySessionVersionToToken/)
    assert.match(migration, /ADD COLUMN IF NOT EXISTS session_version/)
    assert.doesNotMatch(
      db.slice(db.indexOf('export async function upgradeUserPasswordHash')),
      /session_version/
    )
  })
})
