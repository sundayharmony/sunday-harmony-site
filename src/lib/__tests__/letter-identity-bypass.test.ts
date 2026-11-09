import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canBypassLetterIdentityRequirements,
  letterIdentityBypassAllowed,
  wantsLetterIdentityBypass,
} from '@/lib/dispute-letters/letter-identity-bypass'

describe('letter identity bypass', () => {
  it('only honors an explicit bypass flag', () => {
    assert.equal(wantsLetterIdentityBypass({}), false)
    assert.equal(wantsLetterIdentityBypass({ bypass_missing_identity: false }), false)
    assert.equal(wantsLetterIdentityBypass({ bypass_missing_identity: true }), true)
  })

  it('allows admin and credit manager, not clients', () => {
    assert.equal(canBypassLetterIdentityRequirements('admin'), true)
    assert.equal(canBypassLetterIdentityRequirements('credit_manager'), true)
    assert.equal(canBypassLetterIdentityRequirements('client'), false)
    assert.equal(canBypassLetterIdentityRequirements(null), false)
  })

  it('requires both the flag and a staff role', () => {
    assert.equal(letterIdentityBypassAllowed({ bypass_missing_identity: true }, 'admin'), true)
    assert.equal(letterIdentityBypassAllowed({ bypass_missing_identity: true }, 'client'), false)
    assert.equal(letterIdentityBypassAllowed({}, 'admin'), false)
  })

  it('wires generate routes and confirm UI to the bypass', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs')
    const generate = readFileSync('src/app/api/admin/dispute-letters/[id]/generate/route.ts', 'utf8')
    const stream = readFileSync('src/app/api/admin/dispute-letters/[id]/generate/stream/route.ts', 'utf8')
    const confirm = readFileSync('src/components/dispute-letters/DisputeConfirmStep.tsx', 'utf8')
    const client = readFileSync('src/lib/dispute-letters/client-api.ts', 'utf8')
    const bypass = readFileSync('src/lib/dispute-letters/letter-identity-bypass.ts', 'utf8')
    assert.match(generate, /letterIdentityBypassAllowed/)
    assert.match(generate, /canBypass/)
    assert.match(stream, /letterIdentityBypassAllowed/)
    assert.match(confirm, /bypassMissingIdentity/)
    assert.match(confirm, /Bypass required documents/)
    assert.match(client, /bypass_missing_identity/)
    // Client Confirm step imports this module — must stay free of server-only auth/mail deps.
    assert.match(bypass, /from '@\/lib\/staff-roles'/)
    assert.equal(/from ['"]@\/lib\/stripe-admin-auth['"]/.test(bypass), false)
  })
})
