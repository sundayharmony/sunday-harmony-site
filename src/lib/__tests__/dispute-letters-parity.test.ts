import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { bureauHealthCounts, detectBureauCoverage, isNegativeTradeline } from '../dispute-letters/bureau-coverage'
import { currentLetters } from '../dispute-letters/current-letters'
import { isRecommendedDispute } from '../dispute-letters/dispute-selection'
import { defaultInquiryDisputeReason } from '../dispute-letters/dispute-reasons'
import { letterLayout } from '../dispute-letters/letter-layout'
import type { BureauCode, ParsedReport, Tradeline } from '../dispute-letters/types'

const FIXTURES = 'services/dispute-letters-api/app/services/__tests__/fixtures'
const cases = JSON.parse(readFileSync(`${FIXTURES}/parity_cases.json`, 'utf8')) as {
  negative_cases: Array<{
    id: string
    status?: string
    remarks?: string
    is_collection?: boolean
    expect_negative: boolean
  }>
  recommended_cases: Array<{
    id: string
    status?: string
    remarks?: string
    is_collection?: boolean
    repair_priority?: string
    item_category?: string
    expect_recommended: boolean
  }>
  inquiry_reason: { creditor: string; expect_contains: string[] }
  current_letters: Array<{ id: string; title: string; plan_id: string }>
  current_letters_keep_ids: string[]
  bureau_coverage_cases: Array<{
    id: string
    scores: { tuc: number | null; exp: number | null; eqf: number | null }
    file_name: string
    expect_bureaus: BureauCode[]
    expect_coverage: string
  }>
  per_bureau_cases: Array<{
    id: string
    bureau: BureauCode
    tradelines: Array<{
      id: string
      status?: string
      remarks?: string
      account_exp?: string
      is_collection?: boolean
    }>
    expect_total: number
    expect_negative: number
    expect_collections: number
  }>
}
const sample = readFileSync(`${FIXTURES}/letter_sample.txt`, 'utf8')

function tl(partial: Partial<Tradeline> & Pick<Tradeline, 'id'>): Tradeline {
  return {
    creditor: 'Test',
    account_tu: '',
    account_exp: partial.account_exp || '',
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

describe('Python/TS parity fixtures', () => {
  it('matches negative tradeline cases', () => {
    for (const row of cases.negative_cases) {
      const actual = isNegativeTradeline(
        tl({
          id: row.id,
          status: row.status || '',
          remarks: row.remarks || '',
          is_collection: Boolean(row.is_collection),
        })
      )
      assert.equal(actual, row.expect_negative, row.id)
    }
  })

  it('matches recommended dispute cases', () => {
    for (const row of cases.recommended_cases) {
      const actual = isRecommendedDispute(
        tl({
          id: row.id,
          status: row.status || '',
          remarks: row.remarks || '',
          is_collection: Boolean(row.is_collection),
          repair_priority: (row.repair_priority || 'none') as Tradeline['repair_priority'],
          item_category: row.item_category || '',
        })
      )
      assert.equal(actual, row.expect_recommended, row.id)
    }
  })

  it('matches inquiry dispute reason snippets', () => {
    const reason = defaultInquiryDisputeReason(cases.inquiry_reason.creditor)
    for (const needle of cases.inquiry_reason.expect_contains) {
      assert.match(reason, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    }
  })

  it('matches currentLetters collapse', () => {
    const listed = currentLetters(cases.current_letters)
    assert.deepEqual(
      listed.map((row) => row.id),
      cases.current_letters_keep_ids
    )
  })

  it('matches letterLayout date/name on the shared sample', () => {
    const layout = letterLayout(sample)
    assert.equal(layout.date, 'September 12, 2026')
    assert.equal(
      layout.blocks.some((block) => block.kind === 'line' && block.variant === 'name' && block.text === 'JANE CONSUMER'),
      true
    )
  })

  it('matches bureau coverage cases', () => {
    for (const row of cases.bureau_coverage_cases) {
      const report: ParsedReport = {
        source: 'test',
        reference: '',
        report_date: '',
        analysis_summary: '',
        credit_health: {
          scores: row.scores,
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
      }
      const cov = detectBureauCoverage(report, row.file_name)
      assert.deepEqual(cov.bureaus, row.expect_bureaus, row.id)
      assert.equal(cov.coverage, row.expect_coverage, row.id)
    }
  })

  it('matches per-bureau negative counts', () => {
    for (const row of cases.per_bureau_cases) {
      const report: ParsedReport = {
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
        tradelines: row.tradelines.map((t) =>
          tl({
            id: t.id,
            status: t.status || '',
            remarks: t.remarks || '',
            account_exp: t.account_exp || '',
            is_collection: Boolean(t.is_collection),
            bureaus: [],
          })
        ),
        subscribers: [],
        file_type: 'pdf',
        ocr_used: false,
        extraction_quality: 'high',
      }
      const counts = bureauHealthCounts(report, row.bureau)
      assert.equal(counts.total_accounts, row.expect_total, row.id)
      assert.equal(counts.negative_count, row.expect_negative, row.id)
      assert.equal(counts.collection_count, row.expect_collections, row.id)
    }
  })
})
