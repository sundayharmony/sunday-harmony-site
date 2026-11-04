import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isStaleAnalysis, STALE_ANALYSIS_MS } from '../dispute-letters/analysis-liveness'

describe('isStaleAnalysis', () => {
  const now = Date.parse('2026-11-04T18:00:00.000Z')

  it('ignores jobs that are not analyzing', () => {
    const old = new Date(now - STALE_ANALYSIS_MS - 1_000).toISOString()
    assert.equal(isStaleAnalysis('ready', old, now), false)
    assert.equal(isStaleAnalysis('uploaded', old, now), false)
    assert.equal(isStaleAnalysis('failed', old, now), false)
  })

  it('keeps a fresh analyzing job', () => {
    const fresh = new Date(now - 30_000).toISOString()
    assert.equal(isStaleAnalysis('analyzing', fresh, now), false)
  })

  it('flags an analyzing job that has not updated for three minutes', () => {
    const stale = new Date(now - STALE_ANALYSIS_MS).toISOString()
    assert.equal(isStaleAnalysis('analyzing', stale, now), true)
  })

  it('does not guess when the timestamp is missing', () => {
    assert.equal(isStaleAnalysis('analyzing', null, now), false)
    assert.equal(isStaleAnalysis('analyzing', 'not-a-date', now), false)
  })
})
