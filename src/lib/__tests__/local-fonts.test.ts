import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const FONT_DIR = join(process.cwd(), 'src/fonts')

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('self-hosted fonts', () => {
  it('keeps layout and letter signatures off next/font/google', () => {
    const layout = source('src/app/layout.tsx')
    const letters = source('src/components/dispute-letters/DisputeLettersResultStep.tsx')
    assert.match(layout, /from 'next\/font\/local'/)
    assert.match(letters, /from 'next\/font\/local'/)
    assert.doesNotMatch(layout, /next\/font\/google/)
    assert.doesNotMatch(letters, /next\/font\/google/)
    assert.match(layout, /montserrat-latin-wght-normal\.woff2/)
    assert.match(letters, /great-vibes-latin-400-normal\.woff2/)
  })

  it('vendors valid woff2 files so Vercel builds do not fetch Google Fonts', () => {
    for (const name of [
      'montserrat-latin-wght-normal.woff2',
      'great-vibes-latin-400-normal.woff2',
    ]) {
      const buf = readFileSync(join(FONT_DIR, name))
      assert.equal(buf.subarray(0, 4).toString('ascii'), 'wOF2')
      assert.ok(statSync(join(FONT_DIR, name)).size > 1000)
    }
  })
})
