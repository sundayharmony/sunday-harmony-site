import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  hashVerificationToken,
  isHashedVerificationToken,
  verificationTokenMatches,
} from '../verification-token'

describe('verification-token', () => {
  it('hashes tokens with hmac prefix', () => {
    const hashed = hashVerificationToken('123456')
    assert.equal(hashed.startsWith('hmac:'), true)
    assert.equal(isHashedVerificationToken(hashed), true)
  })

  it('matches hashed tokens and rejects wrong codes', () => {
    const code = '654321'
    const hashed = hashVerificationToken(code)
    assert.equal(verificationTokenMatches(hashed, code), true)
    assert.equal(verificationTokenMatches(hashed, '000000'), false)
  })

  it('supports legacy plaintext rows during migration', () => {
    assert.equal(verificationTokenMatches('123456', '123456'), true)
    assert.equal(verificationTokenMatches('123456', '654321'), false)
    assert.equal(isHashedVerificationToken('123456'), false)
  })

  it('normalizes whitespace in codes', () => {
    const hashed = hashVerificationToken('123456')
    assert.equal(verificationTokenMatches(hashed, '123 456'), true)
  })
})
