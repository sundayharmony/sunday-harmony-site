import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  applySessionVersionToToken,
  nextSessionVersion,
  sessionVersionOf,
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
