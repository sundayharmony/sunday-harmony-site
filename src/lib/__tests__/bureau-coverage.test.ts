import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectBureauCoverage,
  formatBureauCoverageLabel,
  getSessionBureauCoverage,
  bureauHealthCounts,
  isNegativeTradeline,
  perBureauFromReport,
  resolveSessionBureauScores,
} from '../dispute-letters/bureau-coverage'
import type { DisputeSessionListItem, ParsedReport, Tradeline } from '../dispute-letters/types'

function emptyReport(partial: Partial<ParsedReport> = {}): ParsedReport {
  return {
    source: 'test',
    reference: '',
    report_date: '',
    analysis_summary: '',
    credit_health: {
      scores: { tuc: null, exp: null, eqf: null },
      total_accounts: 0,
      negative_count: 0,
      collection_count: 0,
      high_priority_count: 0,
      repair_summary: '',
      recommended_actions: [],
    },
    consumer: { name: '', dob: '', ssn_last4: '', addresses: [] },
    tradelines: [],
    subscribers: [],
    file_type: 'pdf',
    ocr_used: false,
    extraction_quality: 'high',
    ...partial,
  }
}

describe('detectBureauCoverage', () => {
  it('detects Experian from score only', () => {
    const report = emptyReport({
      credit_health: {
        scores: { tuc: null, exp: 640, eqf: null },
        total_accounts: 0,
        negative_count: 0,
        collection_count: 0,
        high_priority_count: 0,
        repair_summary: '',
        recommended_actions: [],
      },
    })
    const cov = detectBureauCoverage(report, '')
    assert.deepEqual(cov.bureaus, ['EXP'])
    assert.equal(cov.coverage, 'single')
    assert.equal(cov.confidence, 'high')
  })

  it('detects tri-merge from Credit Hero filename', () => {
    const cov = detectBureauCoverage(emptyReport(), 'Juan Pagan Credit Hero 8-21-2026.pdf')
    assert.deepEqual(cov.bureaus, ['TUC', 'EXP', 'EQF'])
    assert.equal(cov.coverage, 'tri_merge')
  })

  it('leaves out a bureau a 3-bureau file reported nothing for', () => {
    const report = emptyReport({
      credit_health: {
        scores: { tuc: 648, exp: 655, eqf: null },
        total_accounts: 2,
        negative_count: 0,
        collection_count: 0,
        high_priority_count: 0,
        repair_summary: '',
        recommended_actions: [],
      },
      tradelines: [
        tl({ id: 't1', bureaus: ['TUC', 'EXP'] }),
        tl({ id: 't2', bureaus: ['TUC'] }),
      ],
    })
    const cov = detectBureauCoverage(report, 'Colin Kerr 3-Bureau Credit Report 9-20-2026.pdf')
    assert.deepEqual(cov.bureaus, ['TUC', 'EXP'])
    assert.equal(cov.coverage, 'dual')
  })

  it('formats labels', () => {
    assert.equal(
      formatBureauCoverageLabel({ bureaus: ['EXP'], coverage: 'single', confidence: 'high' }),
      'Experian'
    )
    assert.equal(
      formatBureauCoverageLabel({
        bureaus: ['TUC', 'EXP', 'EQF'],
        coverage: 'tri_merge',
        confidence: 'high',
      }),
      '3-bureau'
    )
  })

  it('prefers stored bureau_coverage on session', () => {
    const session = {
      id: 's1',
      admin_user_id: 'a',
      status: 'ready',
      storage_path: 'p',
      file_name: 'weird.pdf',
      file_type: 'pdf',
      report_json: emptyReport({
        bureau_coverage: { bureaus: ['EQF'], coverage: 'single', confidence: 'high' },
      }),
      error_message: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    } as DisputeSessionListItem
    const cov = getSessionBureauCoverage(session)
    assert.deepEqual(cov.bureaus, ['EQF'])
  })

  it('drops a stored bureau the report has no evidence for', () => {
    const session = {
      id: 's2',
      admin_user_id: 'a',
      status: 'ready',
      storage_path: 'p',
      file_name: 'Colin Kerr 3-Bureau Credit Report 9-20-2026.pdf',
      file_type: 'pdf',
      report_json: emptyReport({
        bureau_coverage: { bureaus: ['TUC', 'EXP', 'EQF'], coverage: 'tri_merge', confidence: 'medium' },
        credit_health: {
          scores: { tuc: 648, exp: 655, eqf: null },
          total_accounts: 1,
          negative_count: 0,
          collection_count: 0,
          high_priority_count: 0,
          repair_summary: '',
          recommended_actions: [],
        },
        tradelines: [tl({ id: 't1', bureaus: ['TUC', 'EXP'] })],
      }),
      error_message: null,
      created_at: '2026-09-20T00:00:00.000Z',
      updated_at: '2026-09-20T00:00:00.000Z',
    } as DisputeSessionListItem
    const cov = getSessionBureauCoverage(session)
    assert.deepEqual(cov.bureaus, ['TUC', 'EXP'])
    assert.equal(cov.coverage, 'dual')
  })
})

describe('resolveSessionBureauScores', () => {
  function session(partial: Partial<ParsedReport>, average: number | null): DisputeSessionListItem {
    const intelligence = {
      version: '1',
      analyzed_at: '2026-09-20T00:00:00.000Z',
      report_date: '2026-09-20',
      consumer_name: 'Colin Kerr',
      factors: [],
      overall: {
        band: 'fair',
        narrative: '',
        strengths: [],
        weaknesses: [],
        risk_factors: [],
        improvement_priorities: [],
        average_score: average,
      },
      funding_readiness: {
        level: 'moderate',
        score_0_to_100: 50,
        summary: '',
        blockers: [],
        supportive_signals: [],
        practical_steps: [],
      },
      recommendations: [],
      account_dispute_insights: [],
      recommended_next_steps: [],
      disclaimer: '',
    }
    return {
      id: 's',
      admin_user_id: 'a',
      status: 'ready',
      storage_path: 'p',
      file_name: 'Colin Kerr 3-Bureau Credit Report 9-20-2026.pdf',
      file_type: 'pdf',
      report_json: emptyReport({ ...partial, credit_intelligence: intelligence }),
      error_message: null,
      intelligence_json: intelligence,
      created_at: '2026-09-20T00:00:00.000Z',
      updated_at: '2026-09-20T00:00:00.000Z',
    } as DisputeSessionListItem
  }

  const health = (scores: { tuc: number | null; exp: number | null; eqf: number | null }) => ({
    scores,
    total_accounts: 1,
    negative_count: 0,
    collection_count: 0,
    high_priority_count: 0,
    repair_summary: '',
    recommended_actions: [],
  })

  it('never hands the overall average to a bureau that reported nothing', () => {
    const s = session(
      {
        credit_health: health({ tuc: 648, exp: 655, eqf: null }),
        tradelines: [tl({ id: 't1', bureaus: ['TUC', 'EXP'] })],
      },
      652
    )
    const scores = resolveSessionBureauScores(s, s.intelligence_json!)
    assert.equal(scores.tuc, 648)
    assert.equal(scores.exp, 655)
    assert.equal(scores.eqf, null)
  })

  it('still maps the average onto a single-bureau upload that parsed no score', () => {
    const s = session(
      {
        credit_health: health({ tuc: null, exp: null, eqf: null }),
        tradelines: [tl({ id: 't1', bureaus: ['EXP'], account_exp: '1111' })],
      },
      699
    )
    const scores = resolveSessionBureauScores(s, s.intelligence_json!)
    assert.equal(scores.exp, 699)
    assert.equal(scores.tuc, null)
    assert.equal(scores.eqf, null)
  })
})

function tl(partial: Partial<Tradeline> & Pick<Tradeline, 'id'>): Tradeline {
  return {
    creditor: 'Test Bank',
    account_tu: '',
    account_exp: '',
    account_eqf: '',
    account_type: 'Credit Card',
    status: 'Open',
    balance: '$100',
    past_due: '',
    remarks: '',
    bureaus: ['EXP'],
    is_collection: false,
    selected: false,
    dispute_reason: '',
    analysis_notes: '',
    suggested_dispute_reason: '',
    dispute_bureaus: [],
    dispute_furnisher: false,
    legal_flags: [],
    repair_priority: 'none',
    item_category: '',
    ...partial,
  }
}

describe('isNegativeTradeline', () => {
  it('does not treat never-late or paid/closed current accounts as negative', () => {
    assert.equal(
      isNegativeTradeline(tl({ id: '1', remarks: 'Individual responsibility; never late' })),
      false
    )
    assert.equal(
      isNegativeTradeline(
        tl({
          id: '2',
          status: 'Paid, Closed',
          remarks: 'Joint responsibility; 7-year terms; flagged potentially negative',
        })
      ),
      false
    )
    assert.equal(
      isNegativeTradeline(
        tl({
          id: '3',
          remarks: 'Account previously in dispute - now resolved - reported by subscriber',
        })
      ),
      false
    )
  })

  it('still counts collections, charge-offs, and actual late history', () => {
    assert.equal(isNegativeTradeline(tl({ id: 'c', is_collection: true })), true)
    assert.equal(isNegativeTradeline(tl({ id: 'co', status: 'Charge Off' })), true)
    assert.equal(
      isNegativeTradeline(
        tl({ id: 'pd', status: 'Closed: Paid, was past due 150 days' })
      ),
      true
    )
    assert.equal(isNegativeTradeline(tl({ id: 'late', remarks: '30 days late' })), true)
    assert.equal(isNegativeTradeline(tl({ id: 'disp', remarks: 'Account in dispute' })), true)
  })
})

describe('perBureauFromReport', () => {
  it('recomputes Experian negatives from tradelines instead of a stale stored count', () => {
    const report = emptyReport({
      credit_health: {
        scores: { tuc: null, exp: 699, eqf: null },
        total_accounts: 16,
        negative_count: 14,
        collection_count: 0,
        high_priority_count: 0,
        repair_summary: '',
        recommended_actions: [],
        per_bureau: {
          EXP: { total_accounts: 16, negative_count: 14, collection_count: 0 },
        },
      },
      tradelines: [
        tl({ id: 'open', status: 'Open', remarks: 'Never late', account_exp: '1111' }),
        tl({
          id: 'paid',
          status: 'Paid, Closed',
          remarks: 'flagged potentially negative',
          account_exp: '2222',
        }),
        tl({ id: 'coll', is_collection: true, status: 'Collection', account_exp: '3333' }),
      ],
    })
    const exp = perBureauFromReport(report).EXP
    assert.equal(exp?.total_accounts, 3)
    assert.equal(exp?.negative_count, 1)
    assert.equal(exp?.collection_count, 1)
    assert.equal(bureauHealthCounts(report, 'EXP').negative_count, 1)
  })

  it('counts hard inquiries separately from negative tradelines', () => {
    const report = emptyReport({
      tradelines: [
        tl({ id: 'inq', status: 'Inquiry', account_type: 'Hard Inquiry', item_category: 'inquiry', account_exp: '1111' }),
        tl({ id: 'open', status: 'Open', remarks: 'Never late', account_exp: '2222' }),
      ],
    })
    const counts = bureauHealthCounts(report, 'EXP')
    assert.equal(counts.inquiry_count, 1)
    assert.equal(counts.negative_count, 0)
    assert.equal(counts.total_accounts, 2)
  })
})
