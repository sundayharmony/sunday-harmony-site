import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { describe, it } from 'node:test'
import {
  hashPassword,
  passwordNeedsRehash,
  verifyPassword,
} from '../password-crypto'

function legacyHash(password: string): string {
  const salt = '0123456789abcdef0123456789abcdef'
  const hash = crypto.pbkdf2Sync(password, salt, 10_000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

describe('password-crypto', () => {
  it('creates and verifies the current versioned format', () => {
    const stored = hashPassword('CorrectHorse7')

    assert.match(stored, /^pbkdf2\$210000\$[0-9a-f]{32}\$[0-9a-f]{128}$/)
    assert.equal(verifyPassword('CorrectHorse7', stored), true)
    assert.equal(verifyPassword('WrongHorse7', stored), false)
    assert.equal(passwordNeedsRehash(stored), false)
  })

  it('verifies legacy hashes and marks them for upgrade', () => {
    const stored = legacyHash('LegacyPassword7')

    assert.equal(verifyPassword('LegacyPassword7', stored), true)
    assert.equal(verifyPassword('WrongPassword7', stored), false)
    assert.equal(passwordNeedsRehash(stored), true)
  })

  it('rejects a timing-safe comparison against a tampered hash', () => {
    const stored = hashPassword('Untampered7')
    const replacement = stored.endsWith('a') ? 'b' : 'a'
    const tampered = `${stored.slice(0, -1)}${replacement}`

    assert.equal(verifyPassword('Untampered7', tampered), false)
  })

  it('fails closed for malformed hashes without throwing', () => {
    const malformed = [
      '',
      'no-separator',
      'salt:hash',
      'pbkdf2$not-a-number$salt$hash',
      `pbkdf2$999999999$${'a'.repeat(32)}$${'b'.repeat(128)}`,
      `pbkdf2$210000$${'z'.repeat(32)}$${'b'.repeat(128)}`,
    ]

    for (const stored of malformed) {
      assert.doesNotThrow(() => verifyPassword('Password7', stored))
      assert.equal(verifyPassword('Password7', stored), false)
      assert.equal(passwordNeedsRehash(stored), true)
    }
  })
})
