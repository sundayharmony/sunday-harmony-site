import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  FLAG_CONSISTENT,
  FLAG_INCONSISTENT,
  applyCrossBureauEnrichment,
  classifyMismatchKind,
  mismatchSortKey,
} from '../dispute-letters/cross-bureau'
import { resolvedDisputeReason } from '../dispute-letters/dispute-reasons'
import type { Tradeline } from '../dispute-letters/types'

const FIXTURES = JSON.parse(
  readFileSync(join(process.cwd(), 'src/lib/dispute-letters/fixtures/cross-bureau-cases.json'), 'utf8')
) as Record<string, Record<string, unknown>>

function tl(data: Record<string, unknown>): Tradeline {
  return {
    id: String(data.id),
    creditor: String(data.creditor),
    account_tu: String(data.account_tu || ''),
    account_exp: String(data.account_exp || ''),
    account_eqf: String(data.account_eqf || ''),
    account_type: '',
    status: String(data.status || ''),
    balance: '',
    past_due: '',
    remarks: '',
    payment_history: String(data.payment_history || ''),
    bureaus: (data.bureaus as Tradeline['bureaus']) || [],
    is_collection: false,
    selected: false,
    dispute_reason: '',
    analysis_notes: '',
    suggested_dispute_reason: '',
    dispute_bureaus: [],
    dispute_furnisher: true,
    legal_flags: [],
    repair_priority: 'none',
    item_category: '',
  }
}

describe('cross-bureau classification', () => {
  for (const [key, data] of Object.entries(FIXTURES)) {
    it(`classifies ${key}`, () => {
      const { kind } = classifyMismatchKind(tl(data))
      assert.equal(kind, data.expect_kind)
    })
  }

  it('does not treat single-bureau presence as inconsistency', () => {
    const { kind } = classifyMismatchKind(tl(FIXTURES.C_single_bureau_not_mismatch))
    assert.equal(kind, 'other')
  })

  it('sorts inconsistent before consistent', () => {
    const a = applyCrossBureauEnrichment(tl(FIXTURES.A_inconsistent_late))
    const b = applyCrossBureauEnrichment(tl(FIXTURES.B_consistent_late))
    const ordered = [b, a].sort((x, y) => {
      const kx = mismatchSortKey(x)
      const ky = mismatchSortKey(y)
      return kx[0] - ky[0] || kx[1].localeCompare(ky[1])
    })
    assert.equal(ordered[0].id, 'fix-a-coast')
    assert.ok(ordered[0].legal_flags.includes(FLAG_INCONSISTENT))
  })

  it('builds inconsistency dispute reason', () => {
    const enriched = applyCrossBureauEnrichment(tl(FIXTURES.A_inconsistent_late))
    const reason = resolvedDisputeReason({ ...enriched, dispute_reason: '', suggested_dispute_reason: '' })
    assert.match(reason, /inconsistent/i)
    assert.match(reason, /§611/)
  })

  it('honors staff consistent flag', () => {
    const row = tl(FIXTURES.C_single_bureau_not_mismatch)
    row.legal_flags = [FLAG_CONSISTENT]
    row.mismatch_summary = 'Staff marked consistent late on re-pull'
    const { kind, summary } = classifyMismatchKind(row)
    assert.equal(kind, 'consistent_inaccuracy')
    assert.match(summary, /Staff marked/)
  })
})
