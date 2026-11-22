import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { railOffset, railTravel } from '../rail-motion'

describe('package rail motion', () => {
  it('moves the track by the overflow only', () => {
    assert.equal(railTravel(1200, 400), 800)
    assert.equal(railTravel(300, 400), 0)
    assert.equal(railTravel(Number.NaN, 400), 0)
  })

  it('maps scroll progress to a negative translate', () => {
    assert.equal(railOffset(0, 800), 0)
    assert.equal(railOffset(0.5, 800), -400)
    assert.equal(railOffset(2, 800), -800)
    assert.equal(railOffset(-1, 800), 0)
  })
})
