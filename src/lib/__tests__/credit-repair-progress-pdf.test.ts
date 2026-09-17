import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pdfSafeText } from '../credit-intelligence-pdf'
import {
  accountCardHeight,
  buildCreditRepairProgressPdfBuffer,
  buildCreditRepairProgressPdfInput,
  distributeSlack,
  formatAccountMaskForPdf,
  packSectionPages,
  planAccountCardRows,
  truncateToWidth,
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

describe('pdfSafeText', () => {
  it('replaces Unicode punctuation that breaks Helvetica PDF rendering', () => {
    const raw = 'First report \u2192 Current | FICO\u00AE Score \u2014 655 \u00B7 Sunday Harmony'
    const safe = pdfSafeText(raw)
    assert.ok(!/[\u2192\u2014\u00B7\u00AE]/.test(safe))
    assert.match(safe, /First report -> Current/)
    assert.match(safe, /FICO Score - 655/)
  })
})

describe('formatAccountMaskForPdf', () => {
  it('formats bureau mask dots as a clean last-four suffix', () => {
    assert.equal(formatAccountMaskForPdf('···6684'), '#6684')
    assert.equal(formatAccountMaskForPdf('—'), '')
    assert.ok(!formatAccountMaskForPdf('···1853').includes('|'))
  })
})

describe('progress PDF layout measurement', () => {
  it('measures account cards as padding, title row and gapped field rows', () => {
    const one = accountCardHeight(1)
    const two = accountCardHeight(2)
    const three = accountCardHeight(3)
    assert.ok(one > 0)
    // Each extra field adds its own text row plus the separating gap.
    assert.equal(two - one, three - two)
    assert.ok(two - one > 10, 'field rows keep a visible gap between them')
  })

  it('keeps one card per row in a single column', () => {
    const rows = planAccountCardRows([30, 45, 60], 1)
    assert.deepEqual(rows, [[0], [1], [2]])
  })

  it('pairs equal-height cards into two-column rows without dropping any', () => {
    const heights = [45, 60, 45, 30, 30, 30, 30]
    const rows = planAccountCardRows(heights, 2)
    assert.equal(rows.length, 4)
    const seen = rows.flat().sort((a, b) => a - b)
    assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 6])
    for (const row of rows) assert.ok(row.length <= 2)
    // Two columns must be much shorter than stacking the same cards.
    const stacked = heights.reduce((sum, h) => sum + h, 0)
    const gridHeight = rows.reduce((sum, row) => sum + Math.max(...row.map((i) => heights[i])), 0)
    assert.ok(gridHeight < stacked * 0.7)
  })

  it('pairs cards by height so a two-column grid wastes no space', () => {
    const heights = [30, 60, 45, 30, 60, 45]
    const rows = planAccountCardRows(heights, 2)
    const wasted = rows.reduce((sum, row) => {
      const tallest = Math.max(...row.map((i) => heights[i]))
      return sum + row.reduce((rowSum, i) => rowSum + (tallest - heights[i]), 0)
    }, 0)
    assert.equal(wasted, 0)
  })

  it('spreads slack proportionally without exceeding any cap', () => {
    const shares = distributeSlack(
      [
        { weight: 1, max: 100 },
        { weight: 3, max: 100 },
      ],
      40
    )
    assert.equal(Math.round(shares[0]), 10)
    assert.equal(Math.round(shares[1]), 30)

    const capped = distributeSlack(
      [
        { weight: 1, max: 5 },
        { weight: 1, max: 100 },
      ],
      40
    )
    assert.equal(capped[0], 5)
    assert.equal(Math.round(capped[1]), 35)

    assert.deepEqual(distributeSlack([{ weight: 1, max: 10 }], 0), [0])
    assert.deepEqual(distributeSlack([{ weight: 0, max: 0 }], 50), [0])
  })

  it('keeps a section on one page when it fits', () => {
    const items = Array.from({ length: 5 }, () => ({ height: 40, gapAfter: 6 }))
    assert.deepEqual(packSectionPages(items, 400), [[0, 1, 2, 3, 4]])
  })

  it('never splits blocks marked keep-with-next', () => {
    const items = [
      { height: 300, gapAfter: 6 },
      // Heading + its only item must travel together to the next page.
      { height: 20, gapAfter: 6, keepWithNext: true },
      { height: 20, gapAfter: 0 },
    ]
    const pages = packSectionPages(items, 320)
    assert.equal(pages.length, 2)
    assert.deepEqual(pages[1], [1, 2])
  })

  it('balances an overflowing section instead of dribbling onto a bare page', () => {
    // Filling each page to the brim would leave a single 60pt block alone
    // on the third page.
    const items = Array.from({ length: 13 }, () => ({ height: 60, gapAfter: 6 }))
    const pageHeight = 400
    const pages = packSectionPages(items, pageHeight)
    assert.equal(pages.length, 3)
    const usedHeight = (page: number[]) =>
      page.reduce((sum, index, i) => sum + items[index].height + (i < page.length - 1 ? 6 : 0), 0)
    for (const page of pages) {
      assert.ok(
        usedHeight(page) >= pageHeight * 0.5,
        `page only ${Math.round(usedHeight(page))}pt of ${pageHeight}pt`
      )
    }
    // Nothing is dropped or duplicated.
    assert.deepEqual(
      pages.flat(),
      items.map((_, i) => i)
    )
  })
})

describe('truncateToWidth', () => {
  it('keeps text that fits and ellipsizes text that does not', () => {
    const measure = (s: string) => s.length
    assert.equal(truncateToWidth('Paid, Closed', 20, measure), 'Paid, Closed')
    const cut = truncateToWidth('Closed; Paid, was past due 150 days', 20, measure)
    assert.ok(cut.endsWith('...'))
    assert.ok(measure(cut) <= 20)
    assert.equal(truncateToWidth('', 20, measure), '')
    assert.equal(truncateToWidth('anything', 0, measure), '')
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

    const pdfText = direct.toString('latin1')
    assert.ok(!pdfText.includes("!'"), `unexpected garbled chars in PDF: ${pdfText.slice(0, 500)}`)
  })

  it('starts each comparable bureau on its own page after the cover', async () => {
    const mk = (id: string, createdAt: string, bureau: 'tuc' | 'exp' | 'eqf', score: number) => {
      const scores: { tuc: number | null; exp: number | null; eqf: number | null } = {
        tuc: null,
        exp: null,
        eqf: null,
      }
      scores[bureau] = score
      return session(
        id,
        createdAt,
        intelligence({ score, band: 'fair', fundingLevel: 'moderate', fundingScore: 50, reportDate: createdAt.slice(0, 10) }),
        scores
      )
    }

    const sessions = [
      mk('exp-mar', '2026-03-01T00:00:00.000Z', 'exp', 640),
      mk('exp-jan', '2026-01-01T00:00:00.000Z', 'exp', 580),
      mk('tuc-mar', '2026-03-01T00:00:00.000Z', 'tuc', 650),
      mk('tuc-jan', '2026-01-01T00:00:00.000Z', 'tuc', 600),
    ]

    const prepared = buildCreditRepairProgressPdfInput({
      sessions,
      selectedSessionId: 'exp-mar',
    })
    assert.ok(!('error' in prepared))

    const buf = await buildCreditRepairProgressPdfBuffer(prepared)
    const pageCount = (buf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length
    // Cover + one page per comparable bureau (EXP and TUC here).
    assert.equal(pageCount, 3)
  })

  it('fits a bureau with many changed accounts onto a single page', async () => {
    const line = (index: number, changedState: boolean): Tradeline => ({
      ...chargeOff,
      id: `t${index}`,
      creditor: `CREDITOR NUMBER ${index}`,
      account_exp: `****${1000 + index}`,
      status: changedState ? 'Paid, Closed' : 'Closed; Paid, was past due 150 days',
      balance: changedState ? '$24' : '$1,829',
    })
    const before = Array.from({ length: 11 }, (_, i) => line(i, false))
    const after = Array.from({ length: 11 }, (_, i) => line(i, true))

    const prepared = buildCreditRepairProgressPdfInput({
      sessions: [
        session(
          'exp-mar',
          '2026-03-01T00:00:00.000Z',
          intelligence({
            score: 699,
            band: 'good',
            fundingLevel: 'moderate',
            fundingScore: 60,
            reportDate: '2026-03-01',
          }),
          { tuc: null, exp: 699, eqf: null },
          after
        ),
        session(
          'exp-jan',
          '2026-01-01T00:00:00.000Z',
          intelligence({
            score: 627,
            band: 'fair',
            fundingLevel: 'low',
            fundingScore: 30,
            reportDate: '2026-01-01',
          }),
          { tuc: null, exp: 627, eqf: null },
          before
        ),
      ],
      selectedSessionId: 'exp-mar',
    })
    assert.ok(!('error' in prepared))
    assert.equal(prepared.progressByBureau.EXP?.accountChangesVsBaseline?.changed.length, 11)

    const buf = await buildCreditRepairProgressPdfBuffer(prepared)
    const pageCount = (buf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length
    // Cover + the whole Experian section on one page.
    assert.equal(pageCount, 2)
  })
})
