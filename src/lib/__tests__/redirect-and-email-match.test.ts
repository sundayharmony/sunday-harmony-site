import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { emailIlikePattern, escapeIlikeExact } from '../email-match'
import { getClientIp } from '../rate-limit'
import {
  sanitizeInternalPath,
  sanitizeLoginCallbackUrl,
  sanitizeNotificationLink,
} from '../safe-notification-link'

describe('escapeIlikeExact', () => {
  it('escapes LIKE wildcards and backslashes', () => {
    assert.equal(escapeIlikeExact('john_doe@gmail.com'), 'john\\_doe@gmail.com')
    assert.equal(escapeIlikeExact('100%off@x.com'), '100\\%off@x.com')
    assert.equal(escapeIlikeExact('a\\b'), 'a\\\\b')
  })

  it('trims email patterns used in ILIKE lookups', () => {
    assert.equal(emailIlikePattern('  Jane_Lee@x.com  '), 'Jane\\_Lee@x.com')
  })
})

describe('login callback sanitization', () => {
  it('allows same-origin relative paths', () => {
    assert.equal(sanitizeLoginCallbackUrl('/dashboard'), '/dashboard')
    assert.equal(sanitizeLoginCallbackUrl('/admin/clients?tab=1'), '/admin/clients?tab=1')
    assert.equal(sanitizeInternalPath('/case-studies'), '/case-studies')
  })

  it('rejects open redirects', () => {
    assert.equal(sanitizeLoginCallbackUrl('https://evil.example'), '/')
    assert.equal(sanitizeLoginCallbackUrl('//evil.example'), '/')
    assert.equal(sanitizeLoginCallbackUrl('javascript:alert(1)'), '/')
    assert.equal(sanitizeLoginCallbackUrl(null), '/')
  })

  it('still restricts notification links to dashboard/admin', () => {
    assert.equal(sanitizeNotificationLink('/dashboard/files'), '/dashboard/files')
    assert.equal(sanitizeNotificationLink('/login'), null)
    assert.equal(sanitizeNotificationLink('https://evil.example'), null)
  })
})

describe('getClientIp', () => {
  it('uses the rightmost X-Forwarded-For hop from the trusted edge', () => {
    const req = new Request('https://example.test/', {
      headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' },
    })
    assert.equal(getClientIp(req), '3.3.3.3')
  })

  it('falls back to x-real-ip then unknown', () => {
    const real = new Request('https://example.test/', {
      headers: { 'x-real-ip': '9.9.9.9' },
    })
    assert.equal(getClientIp(real), '9.9.9.9')
    assert.equal(getClientIp(new Request('https://example.test/')), 'unknown')
  })
})

describe('email ILIKE lookups escape wildcards', () => {
  it('wraps every exact email ILIKE in emailIlikePattern', () => {
    const files = [
      'src/lib/db.ts',
      'src/lib/auth.ts',
      'src/lib/webauthn.ts',
      'src/lib/credit-funding-db.ts',
      'src/lib/crm-db.ts',
      'src/app/api/auth/reset-password/route.ts',
    ]
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      const matches = src.match(/\.ilike\(\s*'email'\s*,\s*([^)]+)\)/g) || []
      assert.ok(matches.length > 0, `expected email ILIKE in ${file}`)
      for (const match of matches) {
        assert.match(match, /emailIlikePattern/, `${file}: ${match}`)
      }
    }
  })
})
