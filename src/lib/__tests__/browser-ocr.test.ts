import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isPictureFile, textLayerNeedsOcr, tileRows } from '../dispute-letters/browser-ocr'

describe('browser OCR helpers', () => {
  it('treats thin or garbled PDF text as pictures', () => {
    assert.equal(textLayerNeedsOcr(['', '', '']), true)
    assert.equal(textLayerNeedsOcr(['(cid:3)(cid:4) '.repeat(150)]), true)
    assert.equal(textLayerNeedsOcr(['0 1 2 3 4 5 6 7 8 9 '.repeat(30)]), true)
    assert.equal(textLayerNeedsOcr(['Account Name SAMPLE BANK Balance $1,200 Status Current '.repeat(5)]), false)
  })
  it('splits tall pages into overlapping strips', () => {
    assert.deepEqual(tileRows(1000), [[0, 1000]])
    const rows = tileRows(5000)
    assert.equal(rows.length, 3)
    assert.deepEqual(rows[0], [0, 2260])
    assert.equal(rows[2][1], 5000)
  })
  it('recognises pictures by type or name', () => {
    assert.ok(isPictureFile({ name: 'shot.PNG', type: '' }))
    assert.ok(isPictureFile({ name: 'x', type: 'image/webp' }))
    assert.ok(!isPictureFile({ name: 'report.pdf', type: 'application/pdf' }))
  })
})
