import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAngle, rotatedSize } from '../letter-identity-crop'

describe('letter card rotate', () => {
  it('sizes a rotated canvas and keeps angles in 0-360', () => {
    assert.deepEqual(rotatedSize(400, 200, 90), { w: 200, h: 400 })
    assert.deepEqual(rotatedSize(400, 200, 180), { w: 400, h: 200 })
    assert.equal(normalizeAngle(-90), 270)
    assert.equal(normalizeAngle(450), 90)
  })
})
