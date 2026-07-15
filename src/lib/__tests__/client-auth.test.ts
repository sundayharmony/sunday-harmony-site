import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveClientAccess } from '../client-access'

describe('resolveClientAccess', () => {
  it('rejects a missing session', () => {
    const result = resolveClientAccess(null)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.status, 401)
  })

  it('rejects staff roles even when a clientId is present', () => {
    for (const role of ['admin', 'credit_manager']) {
      const result = resolveClientAccess({ user: { role, clientId: 'client-1' } })
      assert.equal(result.ok, false)
      if (!result.ok) assert.equal(result.status, 403)
    }
  })

  it('rejects a client without a clientId', () => {
    const result = resolveClientAccess({ user: { role: 'client' } })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.status, 403)
  })

  it('returns the session-derived clientId for a provisioned client', () => {
    const result = resolveClientAccess({
      user: { role: 'client', clientId: 'client-abc' },
    })
    assert.deepEqual(result, { ok: true, clientId: 'client-abc' })
  })
})
