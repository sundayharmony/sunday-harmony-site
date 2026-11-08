import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isInquiryTradeline,
  planSelectionsFromTradelines,
  resolvedDisputeReason,
  sanitizeTradelineDisputeReasons,
  usesStaleCleanProfileLanguage,
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

  it('rewrites stale clean-profile boilerplate without a re-upload', () => {
    const stale =
      'This account is reported as Closed. Late 30 Days. Because it is closed and no longer useful ' +
      'to a clean credit profile, I dispute the remaining negative history.'
    assert.equal(usesStaleCleanProfileLanguage(stale), true)
    const [cleaned] = sanitizeTradelineDisputeReasons([
      tl({
        id: 'closed-late',
        creditor: 'Unnamed · Credit Card 601100XXXXXX',
        status: 'Closed. Late 30 Days; Times late 30/60/90: 1/0/0',
        past_due: '$70.00',
        payment_history: 'Times late 30/60/90: 1/0/0',
        balance: '$306.00',
        item_category: 'closed_derogatory',
        legal_flags: ['closed_account', 'closed_derogatory', 'obsolete_negative'],
        dispute_reason: stale,
        suggested_dispute_reason: stale,
        selected: true,
      }),
    ])
    assert.ok(cleaned)
    assert.equal(usesStaleCleanProfileLanguage(cleaned.dispute_reason), false)
    assert.match(cleaned.dispute_reason, /FCRA/)
    assert.match(cleaned.dispute_reason, /delet/i)
    assert.doesNotMatch(cleaned.dispute_reason, /clean credit profile/i)
  })
})
