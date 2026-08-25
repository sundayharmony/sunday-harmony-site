import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectBureauCoverage,
  formatBureauCoverageLabel,
  getSessionBureauCoverage,
} from '../dispute-letters/bureau-coverage'
import type { DisputeSessionListItem, ParsedReport } from '../dispute-letters/types'

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
})
