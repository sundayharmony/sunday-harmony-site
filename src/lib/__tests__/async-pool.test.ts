import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapWithConcurrency, withRetries } from '../dispute-letters/async-pool'

describe('async pool helpers', () => {
  it('preserves order while limiting concurrency', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const started: number[] = []

    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      started.push(value)
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 20))
      inFlight -= 1
      return value * 10
    })

    assert.deepEqual(results, [10, 20, 30, 40, 50])
    assert.ok(maxInFlight <= 2)
    assert.deepEqual(started, [1, 2, 3, 4, 5])
  })

  it('retries transient failures then succeeds', async () => {
    let attempts = 0
    const value = await withRetries(async () => {
      attempts += 1
      if (attempts < 3) throw new Error('transient')
      return 'ok'
    }, 3, 5)
    assert.equal(value, 'ok')
    assert.equal(attempts, 3)
  })

  it('throws the last error after exhausting retries', async () => {
    await assert.rejects(
      () =>
        withRetries(async () => {
          throw new Error('always fails')
        }, 2, 5),
      /always fails/
    )
  })
})
