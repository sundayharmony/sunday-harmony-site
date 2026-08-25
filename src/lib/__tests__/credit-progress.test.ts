import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAllBureauProgress,
  buildBureauProgressDiff,
  buildCreditProgressDiff,
  diffSnapshots,
  snapshotFromSession,
} from '../dispute-letters/credit-progress'
import type {
  CreditIntelligenceReport,
  CreditProgressSnapshot,
  DisputeSessionListItem,
  FactorAnalysis,
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
  factors?: FactorAnalysis[]
  reportDate?: string
}): CreditIntelligenceReport {
  return {
    version: '1',
    analyzed_at: '2026-03-15T12:00:00.000Z',
    report_date: partial.reportDate || '2026-03-01',
    consumer_name: 'Test Client',
    factors: partial.factors || [
      factor('payment_history', 'good'),
      factor('collections', 'poor'),
    ],
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
  intel: CreditIntelligenceReport | null,
  health?: {
    total_accounts: number
    negative_count: number
    collection_count: number
    scores?: { tuc: number | null; exp: number | null; eqf: number | null }
  },
  fileName?: string,
  tradelines?: import('../dispute-letters/types').Tradeline[]
): DisputeSessionListItem {
  return {
    id,
    admin_user_id: 'admin',
    status: 'ready',
    storage_path: `path/${id}`,
    file_name: fileName || `${id}.pdf`,
    file_type: 'application/pdf',
    report_json: intel
      ? {
          source: 'test',
          reference: id,
          report_date: intel.report_date,
          analysis_summary: '',
          credit_health: {
            scores: health?.scores || { tuc: null, exp: null, eqf: null },
            total_accounts: health?.total_accounts ?? 10,
            negative_count: health?.negative_count ?? 3,
            collection_count: health?.collection_count ?? 1,
            high_priority_count: 1,
            repair_summary: '',
            recommended_actions: [],
          },
          credit_intelligence: intel,
          consumer: { name: 'Test Client', dob: '', ssn_last4: '', addresses: [] },
          tradelines: tradelines || [],
          subscribers: [],
          file_type: 'pdf',
          ocr_used: false,
          extraction_quality: 'high',
        }
      : null,
    error_message: null,
    application_uuid: 'app-1',
    intelligence_json: intel,
    created_at: createdAt,
    updated_at: createdAt,
  }
}

describe('snapshotFromSession', () => {
  it('returns null when intelligence is missing', () => {
    const s = session('a', '2026-01-01T00:00:00.000Z', null)
    assert.equal(snapshotFromSession(s), null)
  })

  it('captures score, bands, and health counts', () => {
    const snap = snapshotFromSession(
      session(
        'a',
        '2026-01-01T00:00:00.000Z',
        intelligence({ score: 620, band: 'fair', fundingLevel: 'limited', fundingScore: 40 }),
        { total_accounts: 12, negative_count: 4, collection_count: 2 }
      )
    )
    assert.ok(snap)
    assert.equal(snap.averageScore, 620)
    assert.equal(snap.overallBand, 'fair')
    assert.equal(snap.fundingLevel, 'limited')
    assert.equal(snap.healthCounts.collection_count, 2)
    assert.equal(snap.factorBands.payment_history, 'good')
  })
})

describe('diffSnapshots direction heuristics', () => {
  function baseSnap(overrides: Partial<CreditProgressSnapshot> = {}): CreditProgressSnapshot {
    return {
      sessionId: 'from',
      createdAt: '2026-01-01T00:00:00.000Z',
      reportDate: '2026-01-01',
      analyzedAt: '2026-01-01T00:00:00.000Z',
      fileName: 'a.pdf',
      overallBand: 'fair',
      averageScore: 600,
      fundingLevel: 'limited',
      fundingScore: 35,
      factorBands: { payment_history: 'fair', collections: 'poor' },
      healthCounts: { total_accounts: 10, negative_count: 5, collection_count: 2 },
      bureauCoverage: ['EXP'],
      coverageKind: 'single',
      bureauScores: { tuc: null, exp: 600, eqf: null },
      perBureauHealth: {
        EXP: { total_accounts: 10, negative_count: 5, collection_count: 2 },
      },
      ...overrides,
    }
  }

  it('marks higher scores and better bands as improved', () => {
    const deltas = diffSnapshots(
      baseSnap(),
      baseSnap({
        sessionId: 'to',
        averageScore: 680,
        overallBand: 'good',
        fundingLevel: 'moderate',
        fundingScore: 55,
        factorBands: { payment_history: 'good', collections: 'fair' },
        healthCounts: { total_accounts: 11, negative_count: 2, collection_count: 0 },
      })
    )
    const byField = Object.fromEntries(deltas.map((d) => [d.field, d]))
    assert.equal(byField.average_score.direction, 'improved')
    assert.equal(byField.overall_band.direction, 'improved')
    assert.equal(byField.funding_score.direction, 'improved')
    assert.equal(byField.funding_level.direction, 'improved')
    assert.equal(byField.negative_count.direction, 'improved')
    assert.equal(byField.collection_count.direction, 'improved')
    assert.equal(byField['factor:payment_history'].direction, 'improved')
    assert.equal(byField['factor:collections'].direction, 'improved')
  })

  it('marks lower scores and worse bands as worsened', () => {
    const deltas = diffSnapshots(
      baseSnap({ averageScore: 700, overallBand: 'good', fundingScore: 70, fundingLevel: 'high' }),
      baseSnap({
        sessionId: 'to',
        averageScore: 610,
        overallBand: 'fair',
        fundingScore: 40,
        fundingLevel: 'limited',
        healthCounts: { total_accounts: 10, negative_count: 8, collection_count: 3 },
      })
    )
    const byField = Object.fromEntries(deltas.map((d) => [d.field, d]))
    assert.equal(byField.average_score.direction, 'worsened')
    assert.equal(byField.overall_band.direction, 'worsened')
    assert.equal(byField.funding_score.direction, 'worsened')
    assert.equal(byField.negative_count.direction, 'worsened')
  })

  it('marks unchanged values', () => {
    const snap = baseSnap()
    const deltas = diffSnapshots(snap, { ...snap, sessionId: 'to' })
    assert.ok(deltas.every((d) => d.direction === 'unchanged' || d.field === 'total_accounts'))
    assert.equal(deltas.find((d) => d.field === 'average_score')?.direction, 'unchanged')
  })
})

describe('buildCreditProgressDiff', () => {
  const first = session(
    'first',
    '2026-01-01T00:00:00.000Z',
    intelligence({ score: 580, band: 'poor', fundingLevel: 'low', fundingScore: 25, reportDate: '2026-01-01' }),
    { total_accounts: 8, negative_count: 6, collection_count: 2 }
  )
  const second = session(
    'second',
    '2026-02-01T00:00:00.000Z',
    intelligence({ score: 620, band: 'fair', fundingLevel: 'limited', fundingScore: 40, reportDate: '2026-02-01' }),
    { total_accounts: 9, negative_count: 4, collection_count: 1 }
  )
  const third = session(
    'third',
    '2026-03-01T00:00:00.000Z',
    intelligence({ score: 670, band: 'good', fundingLevel: 'moderate', fundingScore: 58, reportDate: '2026-03-01' }),
    { total_accounts: 10, negative_count: 2, collection_count: 0 }
  )

  it('returns empty progress for a single ready report', () => {
    const report = buildCreditProgressDiff([first], 'first')
    assert.equal(report.readyCount, 1)
    assert.equal(report.baseline?.sessionId, 'first')
    assert.equal(report.current?.sessionId, 'first')
    assert.equal(report.previous, null)
    assert.equal(report.vsBaseline.length, 0)
    assert.equal(report.vsPrevious.length, 0)
  })

  it('uses oldest ready session as baseline and newest as default current', () => {
    // API returns newest-first
    const report = buildCreditProgressDiff([third, second, first], null)
    assert.equal(report.baseline?.sessionId, 'first')
    assert.equal(report.current?.sessionId, 'third')
    assert.equal(report.previous?.sessionId, 'second')
    assert.ok(report.vsBaseline.length > 0)
    assert.ok(report.vsPrevious.length > 0)
    assert.equal(
      report.vsBaseline.find((d) => d.field === 'average_score')?.direction,
      'improved'
    )
  })

  it('diffs a middle selected report against first and previous', () => {
    const report = buildCreditProgressDiff([third, second, first], 'second')
    assert.equal(report.current?.sessionId, 'second')
    assert.equal(report.previous?.sessionId, 'first')
    assert.equal(report.baseline?.sessionId, 'first')
    // vs previous equals vs baseline when previous is baseline
    assert.equal(
      report.vsPrevious.find((d) => d.field === 'average_score')?.to,
      620
    )
    assert.equal(
      report.vsBaseline.find((d) => d.field === 'average_score')?.from,
      580
    )
  })

  it('ignores sessions without intelligence', () => {
    const bare = session('bare', '2026-01-15T00:00:00.000Z', null)
    bare.status = 'ready'
    const report = buildCreditProgressDiff([third, bare, first], 'third')
    assert.equal(report.readyCount, 2)
    assert.equal(report.previous?.sessionId, 'first')
  })
})

describe('buildBureauProgressDiff', () => {
  const expJan = session(
    'exp-jan',
    '2026-01-01T00:00:00.000Z',
    intelligence({ score: 580, band: 'poor', fundingLevel: 'low', fundingScore: 25, reportDate: '2026-01-01' }),
    {
      total_accounts: 5,
      negative_count: 3,
      collection_count: 1,
      scores: { tuc: null, exp: 580, eqf: null },
    },
    'experian-jan.pdf',
    [
      {
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
      },
    ]
  )
  const tucFeb = session(
    'tuc-feb',
    '2026-02-01T00:00:00.000Z',
    intelligence({ score: 600, band: 'fair', fundingLevel: 'limited', fundingScore: 35, reportDate: '2026-02-01' }),
    {
      total_accounts: 4,
      negative_count: 2,
      collection_count: 0,
      scores: { tuc: 600, exp: null, eqf: null },
    },
    'transunion-feb.pdf'
  )
  const expMar = session(
    'exp-mar',
    '2026-03-01T00:00:00.000Z',
    intelligence({ score: 620, band: 'fair', fundingLevel: 'limited', fundingScore: 40, reportDate: '2026-03-01' }),
    {
      total_accounts: 5,
      negative_count: 1,
      collection_count: 0,
      scores: { tuc: null, exp: 620, eqf: null },
    },
    'experian-mar.pdf',
    [
      {
        id: 'e1',
        creditor: 'Capital One',
        account_tu: '',
        account_exp: '****1234',
        account_eqf: '',
        account_type: 'Credit Card',
        status: 'Paid/Closed',
        balance: '$0',
        past_due: '$0',
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
        item_category: 'closed',
      },
    ]
  )

  it('matches Experian→Experian and ignores TransUnion in between', () => {
    const report = buildBureauProgressDiff([expMar, tucFeb, expJan], 'exp-mar', 'EXP')
    assert.equal(report.readyCount, 2)
    assert.equal(report.baseline?.sessionId, 'exp-jan')
    assert.equal(report.current?.sessionId, 'exp-mar')
    assert.equal(report.previous?.sessionId, 'exp-jan')
    assert.equal(report.vsBaseline.find((d) => d.field === 'bureau_score')?.from, 580)
    assert.equal(report.vsBaseline.find((d) => d.field === 'bureau_score')?.to, 620)
    assert.equal(report.vsBaseline.find((d) => d.field === 'bureau_score')?.direction, 'improved')
  })

  it('builds separate tracks in buildAllBureauProgress', () => {
    const all = buildAllBureauProgress([expMar, tucFeb, expJan], 'exp-mar')
    assert.ok(all.EXP)
    assert.ok(all.TUC)
    assert.equal(all.EQF, undefined)
    assert.equal(all.EXP?.readyCount, 2)
    assert.equal(all.TUC?.readyCount, 1)
    assert.equal(all.TUC?.vsBaseline.length, 0)
  })

  it('includes account field changes for matched Experian tradelines', () => {
    const report = buildBureauProgressDiff([expMar, expJan], 'exp-mar', 'EXP')
    const changes = report.accountChangesVsBaseline
    assert.ok(changes)
    assert.equal(changes.changed.length, 1)
    assert.ok(changes.changed[0].fields.some((f) => f.field === 'balance'))
  })
})
