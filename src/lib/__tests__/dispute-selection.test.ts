import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isNegativeTradeline } from '../dispute-letters/bureau-coverage'
import {
  applyRecommendedSelection,
  isRecommendedDispute,
} from '../dispute-letters/dispute-selection'
import type { Tradeline } from '../dispute-letters/types'

function tl(partial: Partial<Tradeline> & Pick<Tradeline, 'id'>): Tradeline {
  return {
    creditor: 'Test',
    account_tu: '',
    account_exp: '',
    account_eqf: '',
    account_type: '',
    status: '',
    balance: '',
    past_due: '',
    remarks: '',
    bureaus: ['EXP'],
    is_collection: false,
    selected: false,
    dispute_reason: '',
    analysis_notes: '',
    suggested_dispute_reason: '',
    dispute_bureaus: ['EXP'],
    dispute_furnisher: false,
    legal_flags: [],
    repair_priority: 'none',
    item_category: '',
    ...partial,
  }
}

describe('isRecommendedDispute vs isNegativeTradeline', () => {
  it('treats medium priority as recommended even when the negative filter would differ', () => {
    const late = tl({ id: 'late', remarks: '30 days late', repair_priority: 'medium' })
    assert.equal(isNegativeTradeline(late), true)
    assert.equal(isRecommendedDispute(late), true)
  })

  it('does not auto-recommend low-priority inquiries', () => {
    const inquiry = tl({
      id: 'inq',
      status: 'Inquiry',
      item_category: 'inquiry',
      repair_priority: 'low',
    })
    assert.equal(isRecommendedDispute(inquiry), false)
  })

  it('keeps already-selected inquiries when applying recommended selection', () => {
    const inquiry = tl({
      id: 'inq',
      status: 'Inquiry',
      item_category: 'inquiry',
      repair_priority: 'low',
      selected: true,
    })
    const collection = tl({
      id: 'coll',
      is_collection: true,
      status: 'Collection',
      repair_priority: 'high',
    })
    const next = applyRecommendedSelection([inquiry, collection])
    assert.equal(next.find((t) => t.id === 'inq')?.selected, true)
    assert.equal(next.find((t) => t.id === 'coll')?.selected, false)
  })

  it('selects recommended disputes when nothing is selected yet', () => {
    const collection = tl({
      id: 'coll',
      is_collection: true,
      repair_priority: 'high',
    })
    const late = tl({ id: 'late', remarks: '30 days late', repair_priority: 'medium' })
    const inquiry = tl({ id: 'inq', item_category: 'inquiry', repair_priority: 'low' })
    const next = applyRecommendedSelection([collection, late, inquiry])
    assert.deepEqual(
      next.filter((t) => t.selected).map((t) => t.id),
      ['coll', 'late']
    )
  })
})
