import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  decodePublicKey,
  encodePublicKey,
  getWebAuthnExpectedOrigins,
  getWebAuthnRpId,
} from '../webauthn'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

function originHosts(siteUrl: string): string[] {
  return getWebAuthnExpectedOrigins(siteUrl).map((origin) => new URL(origin).host)
}

describe('webauthn relying party config', () => {
  it('strips www from the RP ID so apex and www share credentials', () => {
    assert.equal(getWebAuthnRpId('https://www.sundayharmony.com'), 'sundayharmony.com')
    assert.equal(getWebAuthnRpId('https://sundayharmony.com'), 'sundayharmony.com')
    assert.equal(getWebAuthnRpId('http://localhost:3000'), 'localhost')
  })

  it('accepts both www and apex origins', () => {
    assert.deepEqual(originHosts('https://sundayharmony.com').sort(), [
      'sundayharmony.com',
      'www.sundayharmony.com',
    ])
  })

  it('accepts localhost and 127.0.0.1 during local development', () => {
    assert.deepEqual(originHosts('http://localhost:3000').sort(), [
      '127.0.0.1:3000',
      'localhost:3000',
    ])
  })

  it('round-trips public keys as base64url', () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 255])
    const encoded = encodePublicKey(bytes)
    assert.equal(encoded.includes('+'), false)
    assert.equal(encoded.includes('/'), false)
    assert.deepEqual(Array.from(decodePublicKey(encoded)), Array.from(bytes))
  })
})

describe('passkey auth wiring', () => {
  it('stores public keys as text and denies anon access', () => {
    const migration = source('supabase-migration-030-webauthn-passkeys.sql')
    assert.match(migration, /public_key TEXT NOT NULL/)
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
    assert.match(migration, /REVOKE ALL ON TABLE webauthn_credentials FROM anon/)
    assert.match(migration, /passkey_enabled BOOLEAN NOT NULL DEFAULT false/)
  })

  it('registers passwordless and MFA passkey providers', () => {
    const auth = source('src/lib/auth.ts')
    assert.match(auth, /id: 'passkey'/)
    assert.match(auth, /id: 'passkey-mfa'/)
    assert.match(auth, /verifyAuthentication/)
  })

  it('does not expose a session-less passkey verify endpoint', () => {
    const loginRoute = source('src/app/api/auth/webauthn/login/route.ts')
    assert.doesNotMatch(loginRoute, /export async function PUT/)
    assert.doesNotMatch(loginRoute, /hasCredentials/)
  })

  it('requires discoverable credentials for passwordless login', () => {
    const lib = source('src/lib/webauthn.ts')
    assert.match(lib, /residentKey: 'required'/)
    assert.match(lib, /userVerification: 'required'/)
  })
})
