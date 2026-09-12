import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { currentLetters, letterIdentityKey } from '../dispute-letters/current-letters'

function letter(id: string, title: string, planId = id) {
  return { id, plan_id: planId, title }
}

describe('currentLetters', () => {
  it('keeps one latest copy per same-title recipient after three generations', () => {
    const gen = (n: string) => [
      letter(`exp-${n}`, 'Experian — 4 item(s)', 'plan-exp-1'),
      letter(`ca-${n}`, 'CREDIT ACCEPTANCE CORP — 1 item(s)', 'plan-ca'),
      letter(`kikoff-${n}`, 'KIKOFF LENDING LLC — 1 item(s)', 'plan-kikoff'),
      letter(`source-${n}`, 'SOURCE RECEIVABLES — 1 item(s)', 'plan-source'),
      letter(`verizon-${n}`, 'VERIZON WIRELESS — 1 item(s)', 'plan-verizon'),
    ]
    const listed = currentLetters([...gen('1'), ...gen('2'), ...gen('3')])
    assert.deepEqual(
      listed.map((row) => row.title),
      [
        'Experian — 4 item(s)',
        'CREDIT ACCEPTANCE CORP — 1 item(s)',
        'KIKOFF LENDING LLC — 1 item(s)',
        'SOURCE RECEIVABLES — 1 item(s)',
        'VERIZON WIRELESS — 1 item(s)',
      ]
    )
    assert.deepEqual(
      listed.map((row) => row.id),
      ['exp-3', 'ca-3', 'kikoff-3', 'source-3', 'verizon-3']
    )
  })

  it('replaces Experian 4-item with a later 15-item plan instead of keeping both', () => {
    const listed = currentLetters([
      letter('exp-old', 'Experian — 4 item(s)', 'plan-exp-old'),
      letter('ca', 'CREDIT ACCEPTANCE CORP — 1 item(s)', 'plan-ca'),
      letter('exp-new', 'Experian — 15 item(s)', 'plan-exp-new'),
    ])
    assert.deepEqual(
      listed.map((row) => row.title),
      ['CREDIT ACCEPTANCE CORP — 1 item(s)', 'Experian — 15 item(s)']
    )
  })

  it('keeps distinct bureau and furnisher recipients', () => {
    const listed = currentLetters([
      letter('exp', 'Experian — 15 item(s)', 'plan-exp'),
      letter('kikoff', 'KIKOFF LENDING LLC — 1 item(s)', 'plan-kikoff'),
    ])
    assert.equal(listed.length, 2)
    assert.notEqual(letterIdentityKey(listed[0]), letterIdentityKey(listed[1]))
  })
})

describe('current letter wiring', () => {
  it('filters the letters list and ZIP to current letters only', () => {
    const zipRoute = readFileSync(
      'src/app/api/admin/dispute-letters/[id]/letters/download-zip/route.ts',
      'utf8'
    )
    const listRoute = readFileSync('src/app/api/admin/dispute-letters/[id]/letters/route.ts', 'utf8')
    assert.match(zipRoute, /currentLetters/)
    assert.match(listRoute, /currentLetters/)
  })
})
