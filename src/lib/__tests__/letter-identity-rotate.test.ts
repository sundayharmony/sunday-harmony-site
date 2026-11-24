import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { detectLetterCard, normalizeAngle, rotatedSize } from '../letter-identity-crop'

/** A grey photo with a white card centred, tilted `tilt` degrees clockwise. */
function photo(w: number, h: number, cw: number, ch: number, tilt: number) {
  const data = new Uint8ClampedArray(w * h * 4)
  const rad = (tilt * Math.PI) / 180
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = x - w / 2
      const dy = y - h / 2
      // undo the tilt to test against the upright card
      const ux = dx * Math.cos(-rad) - dy * Math.sin(-rad)
      const uy = dx * Math.sin(-rad) + dy * Math.cos(-rad)
      const inCard = Math.abs(ux) <= cw / 2 && Math.abs(uy) <= ch / 2
      const v = inCard ? 245 : 90
      const i = (y * w + x) * 4
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return { data, width: w, height: h }
}

describe('letter card rotate and detect', () => {
  it('sizes a rotated canvas and keeps angles in 0-360', () => {
    assert.deepEqual(rotatedSize(400, 200, 90), { w: 200, h: 400 })
    assert.deepEqual(rotatedSize(400, 200, 180), { w: 400, h: 200 })
    assert.equal(normalizeAngle(-90), 270)
    assert.equal(normalizeAngle(450), 90)
  })

  it('finds a level card and crops tight around it', () => {
    const found = detectLetterCard(photo(200, 160, 120, 76, 0))
    assert.ok(found)
    assert.equal(found.angle, 0)
    assert.ok(Math.abs(found.crop.x - 40 / 200) < 0.03, `x ${found.crop.x}`)
    assert.ok(Math.abs(found.crop.w - 120 / 200) < 0.05, `w ${found.crop.w}`)
    assert.ok(Math.abs(found.crop.h - 76 / 160) < 0.05, `h ${found.crop.h}`)
  })

  it('undoes a tilt', () => {
    const found = detectLetterCard(photo(240, 200, 130, 80, 12))
    assert.ok(found)
    assert.ok(Math.abs(found.angle - 348) < 2, `angle ${found.angle}`)
    const tilted = detectLetterCard(photo(240, 200, 130, 80, -10))
    assert.ok(tilted)
    assert.ok(Math.abs(tilted.angle - 10) < 2, `angle ${tilted.angle}`)
  })

  it('gives up when nothing stands out', () => {
    assert.equal(detectLetterCard(photo(100, 100, 0, 0, 0)), null)
  })
})
