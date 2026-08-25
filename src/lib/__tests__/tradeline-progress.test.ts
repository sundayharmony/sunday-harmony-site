import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { diffTradelinesForBureau, tradelineMatchKey } from '../dispute-letters/tradeline-progress'
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
    bureaus: ['EXP'],
    is_collection: false,
    selected: false,
    dispute_reason: '',
    analysis_notes: '',
    suggested_dispute_reason: '',
    dispute_bureaus: ['EXP'],
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
      scores: { tuc: null, exp: 600, eqf: null },
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

describe('tradelineMatchKey', () => {
  it('prefers bureau account number', () => {
    const key = tradelineMatchKey(
      tl({ id: '1', creditor: 'Bank', account_exp: '****1234' }),
      'EXP'
    )
    assert.ok(key?.startsWith('acct:EXP:'))
  })

  it('does not cross-match EXP and TUC account numbers', () => {
    const expKey = tradelineMatchKey(
      tl({ id: '1', creditor: 'Bank', account_exp: '1111', account_tu: '2222', bureaus: ['EXP', 'TUC'] }),
      'EXP'
    )
    const tucKey = tradelineMatchKey(
      tl({ id: '1', creditor: 'Bank', account_exp: '1111', account_tu: '2222', bureaus: ['EXP', 'TUC'] }),
      'TUC'
    )
    assert.notEqual(expKey, tucKey)
  })
})

describe('diffTradelinesForBureau', () => {
  it('marks balance drop as improved change', () => {
    const prev = report([
      tl({ id: '1', creditor: 'Capital One', account_exp: '****1234', balance: '$500', status: 'Open' }),
    ])
    const curr = report([
      tl({ id: '1', creditor: 'Capital One', account_exp: '****1234', balance: '$0', status: 'Open' }),
    ])
    const diff = diffTradelinesForBureau(prev, curr, 'EXP')
    assert.equal(diff.changed.length, 1)
    const bal = diff.changed[0].fields.find((f) => f.field === 'balance')
    assert.ok(bal)
    assert.equal(bal.direction, 'improved')
  })

  it('lists removed accounts', () => {
    const prev = report([
      tl({ id: '1', creditor: 'Midland', account_exp: '****9999', balance: '$200', is_collection: true }),
    ])
    const curr = report([])
    const diff = diffTradelinesForBureau(prev, curr, 'EXP')
    assert.equal(diff.removed.length, 1)
    assert.equal(diff.removed[0].creditor, 'Midland')
  })

  it('lists added accounts', () => {
    const prev = report([])
    const curr = report([
      tl({ id: '2', creditor: 'New Bank', account_exp: '****5555', balance: '$50' }),
    ])
    const diff = diffTradelinesForBureau(prev, curr, 'EXP')
    assert.equal(diff.added.length, 1)
    assert.equal(diff.added[0].creditor, 'New Bank')
  })
})
