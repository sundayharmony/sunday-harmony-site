import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { healthFromStoredReport } from '../dispute-letters/stored-report-health'
import type { ParsedReport, Tradeline } from '../dispute-letters/types'

function tradeline(partial: Partial<Tradeline> & Pick<Tradeline, 'id' | 'creditor'>): Tradeline {
  return {
    account_tu: '',
    account_exp: '',
    account_eqf: '',
    account_type: '',
    status: 'Open',
    balance: '',
    past_due: '',
    remarks: '',
    credit_limit: '',
    high_credit: '',
    date_opened: '',
    date_of_first_delinquency: '',
    last_reported: '',
    payment_history: '',
    monthly_payment: '',
    bureaus: [],
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
    ...partial,
  }
}

describe('healthFromStoredReport', () => {
  it('returns saved accounts without asking the letter service', () => {
    const report = {
      source: 'fallback_parser',
      reference: '',
      report_date: '2026-11-02',
      analysis_summary: 'Parsed 2 account(s) locally from the uploaded report.',
      credit_health: {
        scores: { tuc: null, exp: 657, eqf: null },
        total_accounts: 2,
        negative_count: 1,
        collection_count: 1,
        high_priority_count: 1,
        repair_summary: 'One collection.',
        recommended_actions: [],
      },
      consumer: { name: 'Sample Client', addresses: [], ssn_last4: '', dob: '' },
      tradelines: [
        tradeline({ id: 'low', creditor: 'Bank', repair_priority: 'low' }),
        tradeline({ id: 'high', creditor: 'Collections', repair_priority: 'high' }),
      ],
      subscribers: [],
      file_type: 'pdf',
      ocr_used: false,
      extraction_quality: 'high',
    } as ParsedReport

    const health = healthFromStoredReport('session-1', report)
    assert.ok(health)
    assert.equal(health?.tradelines_by_priority[0]?.id, 'high')
    assert.equal(health?.credit_health.scores.exp, 657)
    assert.equal(health?.consumer_name, 'Sample Client')
  })

  it('does not invent a health summary when the report has no accounts', () => {
    assert.equal(healthFromStoredReport('session-1', null), null)
  })
})
