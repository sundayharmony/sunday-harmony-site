import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveClientActivityAccess } from '../dashboard-activity-auth'

describe('resolveClientActivityAccess', () => {
  it('rejects missing session', () => {
    const r = resolveClientActivityAccess(null)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.status, 401)
  })

  it('rejects admin role', () => {
    const r = resolveClientActivityAccess({ user: { role: 'admin', clientId: 'c1' } })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.status, 403)
  })

  it('rejects client without clientId', () => {
    const r = resolveClientActivityAccess({ user: { role: 'client' } })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.status, 403)
  })

  it('allows client with clientId', () => {
    const r = resolveClientActivityAccess({ user: { role: 'client', clientId: 'client-abc' } })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.clientId, 'client-abc')
  })
})
