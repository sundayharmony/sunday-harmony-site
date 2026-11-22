import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { workPhoto, workPhotos } from '../work-photos'

describe('work photo slots', () => {
  it('gives every public slot a unique id, a caption, and alt text', () => {
    const ids = workPhotos.map((photo) => photo.id)
    assert.equal(new Set(ids).size, ids.length)
    for (const photo of workPhotos) {
      assert.ok(photo.label.length > 2)
      assert.ok(photo.alt.length > 20)
      assert.equal(typeof photo.src, 'string')
      assert.equal(workPhoto(photo.id).alt, photo.alt)
    }
  })
})
