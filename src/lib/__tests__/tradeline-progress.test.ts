import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  accountDigits,
  diffTradelinesForBureau,
  tradelineMatchKey,
} from '../dispute-letters/tradeline-progress'
import type { ParsedReport, Tradeline } from '../dispute-letters/types'

function tl(partial: Partial<Tradeline> & { id: string; creditor: string }): Tradeline {
  return {
    account_tu: '',
    account_exp: '',
    account_eqf: '',
    account_type: 'Credit Card',
    status: 'Open',
    balance: '',
    past_due: '',
    remarks: '',
    bureaus: ['TUC'],
    is_collection: false,
    selected: false,
    dispute_reason: '',
    analysis_notes: '',
    suggested_dispute_reason: '',
    dispute_bureaus: ['TUC'],
    dispute_furnisher: true,
    legal_flags: [],
    repair_priority: 'none',
    item_category: '',
    ...partial,
  }
}

function report(tradelines: Tradeline[]): ParsedReport {
  return {
    source: 'test',
    reference: '',
    report_date: '2026-01-01',
    analysis_summary: '',
    credit_health: {
      scores: { tuc: 600, exp: null, eqf: null },
      total_accounts: tradelines.length,
      negative_count: 0,
      collection_count: 0,
      high_priority_count: 0,
      repair_summary: '',
      recommended_actions: [],
    },
    consumer: { name: 'Test', dob: '', ssn_last4: '', addresses: [] },
    tradelines,
    subscribers: [],
    file_type: 'pdf',
    ocr_used: false,
    extraction_quality: 'high',
  }
}

describe('accountDigits / match keys', () => {
  it('strips mask characters so **** and XXXX share digits', () => {
    assert.equal(accountDigits('47******'), '47')
    assert.equal(accountDigits('47XXXXXX'), '47')
    assert.equal(accountDigits('****1234'), '1234')
    assert.equal(accountDigits('····1823'), '1823')
  })

  it('keys by creditor + last4 ignoring mask format', () => {
    const a = tradelineMatchKey(
      tl({ id: '1', creditor: 'SYNCB/PPC', account_tu: '****1823', bureaus: ['TUC'] }),
      'TUC'
    )
    const b = tradelineMatchKey(
      tl({ id: '2', creditor: 'SYNCB/PPC', account_tu: 'XXXX1823', bureaus: ['TUC'] }),
      'TUC'
    )
    assert.equal(a, b)
    assert.ok(a?.includes(':1823'))
  })
})

describe('diffTradelinesForBureau', () => {
  it('does not list the same masked account as removed and new', () => {
    const prev = report([
      tl({
        id: '1',
        creditor: 'CITADEL FCU',
        account_tu: '47******',
        status: 'Open/Current',
        balance: '$100',
        bureaus: ['TUC'],
      }),
      tl({
        id: '2',
        creditor: 'SYNCB/PPC',
        account_tu: '****1823',
        status: 'Open',
        balance: '$50',
        bureaus: ['TUC'],
      }),
    ])
    const curr = report([
      tl({
        id: '1b',
        creditor: 'CITADEL FCU',
        account_tu: '47XXXXXX',
        status: 'Open/Current',
        balance: '$100',
        bureaus: ['TUC'],
      }),
      tl({
        id: '2b',
        creditor: 'SYNCB/PPC',
        account_tu: 'XXXX1823',
        status: 'Open',
        balance: '$50',
        bureaus: ['TUC'],
      }),
    ])
    const diff = diffTradelinesForBureau(prev, curr, 'TUC')
    assert.equal(diff.removed.length, 0)
    assert.equal(diff.added.length, 0)
  })

  it('marks balance drop as improved change', () => {
    const prev = report([
      tl({
        id: '1',
        creditor: 'Capital One',
        account_tu: '****1234',
        balance: '$500',
        status: 'Open',
        bureaus: ['TUC'],
      }),
    ])
    const curr = report([
      tl({
        id: '1',
        creditor: 'Capital One',
        account_tu: 'XXXX1234',
        balance: '$0',
        status: 'Open',
        bureaus: ['TUC'],
      }),
    ])
    const diff = diffTradelinesForBureau(prev, curr, 'TUC')
    assert.equal(diff.removed.length, 0)
    assert.equal(diff.added.length, 0)
    assert.equal(diff.changed.length, 1)
    const bal = diff.changed[0].fields.find((f) => f.field === 'balance')
    assert.ok(bal)
    assert.equal(bal.direction, 'improved')
  })

  it('lists truly removed accounts', () => {
    const prev = report([
      tl({
        id: '1',
        creditor: 'Midland',
        account_tu: '****9999',
        balance: '$200',
        is_collection: true,
        bureaus: ['TUC'],
      }),
    ])
    const curr = report([])
    const diff = diffTradelinesForBureau(prev, curr, 'TUC')
    assert.equal(diff.removed.length, 1)
    assert.equal(diff.removed[0].creditor, 'Midland')
  })

  it('lists truly added accounts', () => {
    const prev = report([])
    const curr = report([
      tl({
        id: '2',
        creditor: 'New Bank',
        account_tu: '****5555',
        balance: '$50',
        bureaus: ['TUC'],
      }),
    ])
    const diff = diffTradelinesForBureau(prev, curr, 'TUC')
    assert.equal(diff.added.length, 1)
    assert.equal(diff.added[0].creditor, 'New Bank')
  })

  it('does not cross-match different last4 for same creditor', () => {
    const prev = report([
      tl({ id: '1', creditor: 'SYNCB/PPC', account_tu: '****1823', bureaus: ['TUC'] }),
    ])
    const curr = report([
      tl({ id: '2', creditor: 'SYNCB/PPC', account_tu: '****4478', bureaus: ['TUC'] }),
    ])
    const diff = diffTradelinesForBureau(prev, curr, 'TUC')
    assert.equal(diff.removed.length, 1)
    assert.equal(diff.added.length, 1)
  })

  it('ignores cosmetic inquiry status and remarks rephrasing', () => {
    const prev = report([
      tl({
        id: '1',
        creditor: 'KEYPORT KIA',
        account_tu: '****1111',
        account_type: 'Hard Inquiry',
        status: 'Inquiry',
        remarks: 'Date of inquiry: 7/18/2026',
        bureaus: ['TUC'],
      }),
      tl({
        id: '2',
        creditor: 'Capital One',
        account_tu: '****2222',
        account_type: 'Credit Card',
        status: 'Open',
        balance: '$500',
        bureaus: ['TUC'],
      }),
    ])
    const curr = report([
      tl({
        id: '1b',
        creditor: 'KEYPORT KIA',
        account_tu: 'XXXX1111',
        account_type: 'Hard Inquiry',
        status: 'Inquiry on record until Aug 2028',
        remarks: 'Inquired Jul 18, 2026',
        bureaus: ['TUC'],
      }),
      tl({
        id: '2b',
        creditor: 'Capital One',
        account_tu: 'XXXX2222',
        account_type: 'Credit Card',
        status: 'Open',
        balance: '$0',
        bureaus: ['TUC'],
      }),
    ])
    const diff = diffTradelinesForBureau(prev, curr, 'TUC')
    assert.equal(diff.removed.length, 0)
    assert.equal(diff.added.length, 0)
    // Inquiry noise ignored; only Capital One balance change remains
    assert.equal(diff.changed.length, 1)
    assert.equal(diff.changed[0].creditor, 'Capital One')
    assert.ok(diff.changed[0].fields.every((f) => f.field === 'balance'))
  })
})
