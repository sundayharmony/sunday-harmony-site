import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isInquiryTradeline,
  planSelectionsFromTradelines,
  resolvedDisputeReason,
} from '../dispute-letters/dispute-reasons'
import type { Tradeline } from '../dispute-letters/types'

function tl(partial: Partial<Tradeline> & Pick<Tradeline, 'id' | 'creditor'>): Tradeline {
  return {
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
    repair_priority: 'low',
    item_category: '',
    ...partial,
  }
}

describe('inquiry dispute plan selections', () => {
  it('keeps selected inquiries even when the reason box is empty', () => {
    const inquiry = tl({
      id: 'td-bank',
      creditor: 'TD BANK N.A.',
      item_category: 'inquiry',
      status: 'Inquiry',
      selected: true,
    })
    const collection = tl({
      id: 'coll',
      creditor: 'SOURCE RECEIVABLES',
      item_category: 'collection',
      selected: true,
      dispute_reason: 'Request deletion of this collection.',
    })
    const skipped = tl({
      id: 'open',
      creditor: 'OPEN CARD',
      selected: false,
    })

    const selections = planSelectionsFromTradelines([inquiry, collection, skipped])
    assert.equal(selections.length, 2)
    const inquirySel = selections.find((s) => s.id === 'td-bank')
    assert.ok(inquirySel)
    assert.match(inquirySel.dispute_reason, /TD BANK N\.A\./)
    assert.match(inquirySel.dispute_reason, /§604/)
    assert.equal(
      selections.find((s) => s.id === 'coll')?.dispute_reason,
      'Request deletion of this collection.'
    )
  })

  it('detects inquiry rows from status text', () => {
    assert.equal(
      isInquiryTradeline(tl({ id: '1', creditor: 'UNITED AUTO CREDIT CO', status: 'Inquiry' })),
      true
    )
    assert.equal(isInquiryTradeline(tl({ id: '2', creditor: 'CARD', status: 'Open' })), false)
  })

  it('does not invent a reason when one is already typed', () => {
    const reason = resolvedDisputeReason(
      tl({
        id: '1',
        creditor: 'TD BANK N.A.',
        item_category: 'inquiry',
        dispute_reason: 'Custom inquiry reason.',
      })
    )
    assert.equal(reason, 'Custom inquiry reason.')
  })
})
