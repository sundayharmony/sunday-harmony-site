import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTotp,
  generateBackupCodes,
  generateTotpSecret,
  verifyTotpCode,
  consumeBackupCode,
} from '../mfa-totp'

describe('mfa-totp', () => {
  it('verifies a live TOTP code for a generated secret', () => {
    const secret = generateTotpSecret()
    const totp = buildTotp(secret, 'test@example.com')
    const code = totp.generate()
    assert.equal(verifyTotpCode(secret, code, 'test@example.com'), true)
    assert.equal(verifyTotpCode(secret, '000000', 'test@example.com'), false)
  })

  it('consumes backup codes once', () => {
    const { plain, hashes } = generateBackupCodes()
    const first = consumeBackupCode(hashes, plain[0])
    assert.equal(first.ok, true)
    if (!first.ok) return
    assert.equal(first.remaining.length, hashes.length - 1)
    const again = consumeBackupCode(first.remaining, plain[0])
    assert.equal(again.ok, false)
  })
})
