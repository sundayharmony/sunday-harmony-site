import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveAdminAccess,
  resolveCreditFundingStaffAccess,
  resolveStaffAccess,
  isAdminRole,
  isCreditFundingStaffRole,
} from '../stripe-admin-auth'

describe('admin auth role checks', () => {
  it('isAdminRole accepts admin only', () => {
    assert.equal(isAdminRole('admin'), true)
    assert.equal(isAdminRole('credit_manager'), false)
    assert.equal(isAdminRole('client'), false)
  })

  it('isCreditFundingStaffRole accepts admin and credit_manager', () => {
    assert.equal(isCreditFundingStaffRole('admin'), true)
    assert.equal(isCreditFundingStaffRole('credit_manager'), true)
    assert.equal(isCreditFundingStaffRole('client'), false)
  })
})

describe('resolveAdminAccess', () => {
  it('rejects missing session', () => {
    const r = resolveAdminAccess(null)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.status, 401)
  })

  it('rejects credit_manager', () => {
    const r = resolveAdminAccess({ user: { role: 'credit_manager' } })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.status, 403)
  })

  it('allows admin', () => {
    const r = resolveAdminAccess({ user: { role: 'admin' } })
    assert.equal(r.ok, true)
  })
})

describe('resolveCreditFundingStaffAccess', () => {
  it('allows credit_manager', () => {
    const r = resolveCreditFundingStaffAccess({ user: { role: 'credit_manager' } })
    assert.equal(r.ok, true)
  })

  it('rejects client', () => {
    const r = resolveCreditFundingStaffAccess({ user: { role: 'client' } })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.status, 403)
  })
})

describe('resolveStaffAccess', () => {
  it('allows credit_manager for team chat', () => {
    const r = resolveStaffAccess({ user: { role: 'credit_manager' } })
    assert.equal(r.ok, true)
  })

  it('rejects client', () => {
    const r = resolveStaffAccess({ user: { role: 'client' } })
    assert.equal(r.ok, false)
  })
})
