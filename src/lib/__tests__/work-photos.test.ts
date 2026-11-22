import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { storyShot, storyShotIds, workPhoto, workPhotos } from '../work-photos'

describe('work photos', () => {
  it('points every public photo at a file in public/work', () => {
    const ids = workPhotos.map((photo) => photo.id)
    assert.equal(new Set(ids).size, ids.length)
    for (const photo of workPhotos) {
      assert.ok(photo.label.length > 2)
      assert.ok(photo.alt.length > 20)
      assert.ok(photo.src.startsWith('/work/'))
      assert.ok(photo.width > 0 && photo.height > 0)
      assert.ok(existsSync(path.join(process.cwd(), 'public', photo.src)))
      assert.equal(workPhoto(photo.id).src, photo.src)
    }
    for (const id of storyShotIds) {
      const shot = storyShot(id)
      assert.ok(existsSync(path.join(process.cwd(), 'public', shot.src)))
    }
  })
})
