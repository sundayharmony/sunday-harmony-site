import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCreditRepairProgressPdfBuffer,
  buildCreditRepairProgressPdfInput,
} from '../credit-repair-progress-pdf'
import {
  creditRepairProgressPdfFilename,
  renderCreditRepairProgressPdf,
} from '../credit-repair-progress-pdf-server'
import type {
  CreditIntelligenceReport,
  DisputeSessionListItem,
  FactorAnalysis,
  Tradeline,
} from '../dispute-letters/types'

function factor(name: string, band: string): FactorAnalysis {
  return {
    factor: name,
    weight_hint: 0.1,
    summary: `${name} summary`,
    score_band: band,
    findings: [],
    metrics: {},
    strengths: [],
    weaknesses: [],
    recommendations: [],
  }
}

function intelligence(partial: {
  score: number | null
  band: string
  fundingLevel: string
  fundingScore: number
  reportDate?: string
  name?: string
}): CreditIntelligenceReport {
  return {
    version: '1',
    analyzed_at: '2026-03-15T12:00:00.000Z',
    report_date: partial.reportDate || '2026-03-01',
    consumer_name: partial.name || 'Jamie Client',
    factors: [factor('payment_history', 'good'), factor('collections', 'poor')],
    overall: {
      band: partial.band,
      narrative: 'Narrative',
      strengths: [],
      weaknesses: [],
      risk_factors: [],
      improvement_priorities: [],
      average_score: partial.score,
    },
    funding_readiness: {
      level: partial.fundingLevel,
      score_0_to_100: partial.fundingScore,
      summary: 'Funding summary',
      blockers: [],
      supportive_signals: [],
      practical_steps: [],
    },
    recommendations: [],
    account_dispute_insights: [],
    recommended_next_steps: [],
    disclaimer: 'Educational only.',
  }
}

function session(
  id: string,
  createdAt: string,
  intel: CreditIntelligenceReport,
  scores: { tuc: number | null; exp: number | null; eqf: number | null },
  tradelines: Tradeline[] = []
): DisputeSessionListItem {
  return {
    id,
    admin_user_id: 'admin',
    status: 'ready',
    storage_path: `path/${id}`,
    file_name: `${id}.pdf`,
    file_type: 'application/pdf',
    report_json: {
      source: 'test',
      reference: id,
      report_date: intel.report_date,
      analysis_summary: '',
      credit_health: {
        scores,
        total_accounts: 5,
        negative_count: 2,
        collection_count: 1,
        high_priority_count: 1,
        repair_summary: '',
        recommended_actions: [],
      },
      credit_intelligence: intel,
      consumer: { name: 'Jamie Client', dob: '', ssn_last4: '', addresses: [] },
      tradelines,
      subscribers: [],
      file_type: 'pdf',
      ocr_used: false,
      extraction_quality: 'high',
    },
    error_message: null,
    application_uuid: 'app-1',
    intelligence_json: intel,
    created_at: createdAt,
    updated_at: createdAt,
  }
}

const chargeOff: Tradeline = {
  id: 'e1',
  creditor: 'Capital One',
  account_tu: '',
  account_exp: '****1234',
  account_eqf: '',
  account_type: 'Credit Card',
  status: 'Charge Off',
  balance: '$842',
  past_due: '$100',
  remarks: '',
  bureaus: ['EXP'],
  is_collection: false,
  selected: false,
  dispute_reason: '',
  analysis_notes: '',
  suggested_dispute_reason: '',
  dispute_bureaus: ['EXP'],
  dispute_furnisher: true,
  legal_flags: ['charge_off'],
  repair_priority: 'high',
  item_category: 'charge_off',
}

const paid: Tradeline = {
  ...chargeOff,
  status: 'Paid/Closed',
  balance: '$0',
  past_due: '$0',
  legal_flags: [],
  repair_priority: 'none',
  item_category: 'closed',
}

describe('buildCreditRepairProgressPdfInput', () => {
  it('errors when fewer than two comparable bureau reports exist', () => {
    const onlyOne = session(
      'exp-only',
      '2026-01-01T00:00:00.000Z',
      intelligence({ score: 580, band: 'poor', fundingLevel: 'low', fundingScore: 25 }),
      { tuc: null, exp: 580, eqf: null }
    )
    const result = buildCreditRepairProgressPdfInput({
      sessions: [onlyOne],
      selectedSessionId: 'exp-only',
    })
    assert.ok('error' in result)
  })

  it('builds input without funding metric fields in deltas', () => {
    const first = session(
      'exp-jan',
      '2026-01-01T00:00:00.000Z',
      intelligence({
        score: 580,
        band: 'poor',
        fundingLevel: 'low',
        fundingScore: 25,
        reportDate: '2026-01-01',
      }),
      { tuc: null, exp: 580, eqf: null },
      [chargeOff]
    )
    const second = session(
      'exp-mar',
      '2026-03-01T00:00:00.000Z',
      intelligence({
        score: 640,
        band: 'fair',
        fundingLevel: 'moderate',
        fundingScore: 55,
        reportDate: '2026-03-01',
      }),
      { tuc: null, exp: 640, eqf: null },
      [paid]
    )

    const result = buildCreditRepairProgressPdfInput({
      sessions: [second, first],
      selectedSessionId: 'exp-mar',
      compareMode: 'baseline',
    })
    assert.ok(!('error' in result))
    assert.equal(result.compareMode, 'baseline')
    assert.ok(result.progressByBureau.EXP)

    const deltas = result.progressByBureau.EXP!.vsBaseline
    assert.ok(deltas.every((d) => !d.field.startsWith('funding_')))
    assert.ok(deltas.some((d) => d.field === 'bureau_score'))
    assert.ok(result.progressByBureau.EXP!.accountChangesVsBaseline?.changed.length)
  })
})

describe('credit repair progress PDF render', () => {
  it('renders a valid PDF buffer and filename', async () => {
    const first = session(
      'exp-jan',
      '2026-01-01T00:00:00.000Z',
      intelligence({
        score: 580,
        band: 'poor',
        fundingLevel: 'low',
        fundingScore: 25,
        reportDate: '2026-01-01',
        name: 'Jamie Client',
      }),
      { tuc: null, exp: 580, eqf: null },
      [chargeOff]
    )
    const second = session(
      'exp-mar',
      '2026-03-01T00:00:00.000Z',
      intelligence({
        score: 640,
        band: 'fair',
        fundingLevel: 'moderate',
        fundingScore: 55,
        reportDate: '2026-03-01',
        name: 'Jamie Client',
      }),
      { tuc: null, exp: 640, eqf: null },
      [paid]
    )

    const prepared = buildCreditRepairProgressPdfInput({
      sessions: [second, first],
      selectedSessionId: 'exp-mar',
    })
    assert.ok(!('error' in prepared))

    const buf = await renderCreditRepairProgressPdf(prepared)
    assert.equal(buf.subarray(0, 5).toString(), '%PDF-')
    assert.ok(buf.length > 800)

    const name = creditRepairProgressPdfFilename(prepared)
    assert.match(name, /^Credit-Progress-Jamie-Client-vs-first-\d{4}-\d{2}-\d{2}\.pdf$/)

    // Also exercise the buffer builder directly
    const direct = await buildCreditRepairProgressPdfBuffer(prepared)
    assert.equal(direct.subarray(0, 5).toString(), '%PDF-')
  })
})
