import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyGeminiRead,
  geminiReportMimeType,
  needsGeminiReportFallback,
  parseGeminiReportPayload,
  readReportWithGemini,
  reportNeedsModelRead,
} from '../dispute-letters/gemini-report-read'
import type { ParsedReport } from '../dispute-letters/types'

function emptyReport(): ParsedReport {
  return {
    source: 'fallback_parser',
    reference: '',
    report_date: '',
    analysis_summary: 'Parsed locally. No accounts matched a known report layout.',
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
    extraction_quality: 'low',
  }
}

describe('reportNeedsModelRead', () => {
  it('triggers on empty tradelines without requiring GEMINI_API_KEY', () => {
    const previous = process.env.GEMINI_API_KEY
    delete process.env.GEMINI_API_KEY
    try {
      assert.equal(reportNeedsModelRead(emptyReport()), true)
      assert.equal(needsGeminiReportFallback(emptyReport()), false)
    } finally {
      if (previous === undefined) delete process.env.GEMINI_API_KEY
      else process.env.GEMINI_API_KEY = previous
    }
  })

  it('triggers when most creditors are provisional Unnamed placeholders', () => {
    const report = emptyReport()
    report.extraction_quality = 'medium'
    report.tradelines = [
      {
        id: 'u1',
        creditor: 'Unnamed · Auto Loan 228533XXXXXX',
        account_tu: '228533XXXXXX',
        account_exp: '',
        account_eqf: '',
        account_type: 'Auto Loan',
        status: 'Open. Late 30 Days',
        balance: '$18703.00',
        past_due: '$250.00',
        remarks: '',
        bureaus: ['TUC'],
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
      },
    ]
    assert.equal(reportNeedsModelRead(report), true)
  })
})

describe('needsGeminiReportFallback', () => {
  it('triggers on empty tradelines when API key present', () => {
    process.env.GEMINI_API_KEY = 'test-key'
    try {
      assert.equal(needsGeminiReportFallback(emptyReport()), true)
    } finally {
      delete process.env.GEMINI_API_KEY
    }
  })

  it('triggers on weak/malformed nonempty parse (thin shells)', () => {
    process.env.GEMINI_API_KEY = 'test-key'
    try {
      const weak = emptyReport()
      weak.tradelines = [
        {
          id: 'x1',
          creditor: '',
          account_tu: '',
          account_exp: '',
          account_eqf: '',
          account_type: '',
          status: '',
          balance: '',
          past_due: '',
          remarks: '',
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
        },
      ]
      weak.extraction_quality = 'medium'
      assert.equal(needsGeminiReportFallback(weak), true)
    } finally {
      delete process.env.GEMINI_API_KEY
    }
  })

  it('skips healthy nonempty reports', () => {
    process.env.GEMINI_API_KEY = 'test-key'
    try {
      const ok = emptyReport()
      ok.extraction_quality = 'high'
      ok.tradelines = [
        {
          id: 'good',
          creditor: 'HARBOR BANK',
          account_tu: '1111',
          account_exp: '',
          account_eqf: '',
          account_type: 'Revolving',
          status: 'Open',
          balance: '100',
          past_due: '',
          remarks: '',
          bureaus: ['TUC'],
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
        },
      ]
      assert.equal(needsGeminiReportFallback(ok), false)
    } finally {
      delete process.env.GEMINI_API_KEY
    }
  })
})

describe('parseGeminiReportPayload', () => {
  it('keeps a real account and drops an empty creditor', () => {
    const read = parseGeminiReportPayload(
      JSON.stringify({
        scores: { tuc: null, exp: 657, eqf: 200 },
        tradelines: [
          {
            creditor: 'HARBOR BANK',
            account_number: '426412XXXX',
            status: 'Open',
            balance: '$640.00',
            account_type: 'Credit Card',
            bureaus: ['EXP'],
          },
          { creditor: 'Unknown', status: 'Open', balance: '$1' },
        ],
      }),
      'sample-experian.pdf'
    )
    assert.equal(read.tradelines.length, 1)
    assert.equal(read.tradelines[0]?.creditor, 'HARBOR BANK')
    assert.equal(read.tradelines[0]?.account_exp, '426412XXXX')
    assert.equal(read.tradelines[0]?.account_tu, '')
    assert.equal(read.scores.exp, 657)
    assert.equal(read.scores.eqf, null)
  })

  it('ignores prose that is not JSON', () => {
    const read = parseGeminiReportPayload('not a report', 'scan.pdf')
    assert.deepEqual(read.tradelines, [])
  })
})

describe('applyGeminiRead', () => {
  it('replaces an empty local parse with the scan accounts', () => {
    const next = applyGeminiRead(emptyReport(), {
      scores: { exp: 610 },
      tradelines: [
        {
          id: 'a',
          creditor: 'PINE COLLECTIONS',
          account_tu: '',
          account_exp: '9988',
          account_eqf: '',
          account_type: 'Collection',
          status: 'Collection',
          balance: '$120',
          past_due: '',
          remarks: '',
          credit_limit: '',
          high_credit: '',
          date_opened: '',
          date_of_first_delinquency: '',
          last_reported: '',
          payment_history: '',
          monthly_payment: '',
          bureaus: ['EXP'],
          is_collection: true,
          selected: false,
          dispute_reason: '',
          analysis_notes: '',
          suggested_dispute_reason: '',
          dispute_bureaus: ['EXP'],
          dispute_furnisher: true,
          legal_flags: [],
          repair_priority: 'high',
          item_category: 'collection',
        },
      ],
    })
    assert.equal(next.source, 'gemini')
    assert.equal(next.credit_health.total_accounts, 1)
    assert.equal(next.credit_health.collection_count, 1)
    assert.equal(next.credit_health.scores.exp, 610)
    assert.match(next.analysis_summary, /1 account/)
  })

  it('merges real Gemini names onto Unnamed local rows and keeps late facts', () => {
    const local = emptyReport()
    local.extraction_quality = 'low'
    local.tradelines = [
      {
        id: 'local-ally',
        creditor: 'Unnamed · Auto Loan 228533XXXXXX',
        account_tu: '228533XXXXXX',
        account_exp: '',
        account_eqf: '',
        account_type: 'Auto Loan',
        status: 'Open. Late 30 Days; Times late 30/60/90: 1/0/0',
        balance: '$18703.00',
        past_due: '$250.00',
        remarks: '',
        credit_limit: '',
        high_credit: '',
        date_opened: '',
        date_of_first_delinquency: '',
        last_reported: '',
        payment_history: 'Times late 30/60/90: 1/0/0',
        monthly_payment: '',
        bureaus: ['TUC'],
        is_collection: false,
        selected: false,
        dispute_reason: '',
        analysis_notes: '',
        suggested_dispute_reason: '',
        dispute_bureaus: ['TUC'],
        dispute_furnisher: true,
        legal_flags: [],
        repair_priority: 'medium',
        item_category: 'late_payment',
      },
    ]
    const next = applyGeminiRead(local, {
      scores: { tuc: 627 },
      tradelines: [
        {
          id: 'gem-ally',
          creditor: 'ALLY FINCL',
          account_tu: '228533XXXXXX',
          account_exp: '',
          account_eqf: '',
          account_type: 'Auto Loan',
          status: 'Open',
          balance: '$18703.00',
          past_due: '$250.00',
          remarks: '',
          credit_limit: '',
          high_credit: '',
          date_opened: '',
          date_of_first_delinquency: '',
          last_reported: '',
          payment_history: '',
          monthly_payment: '',
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
        },
      ],
    })
    assert.equal(next.source, 'gemini')
    assert.equal(next.tradelines[0]?.creditor, 'ALLY FINCL')
    assert.match(next.tradelines[0]?.status || '', /Late 30/)
    assert.equal(next.tradelines[0]?.past_due, '$250.00')
    assert.equal(next.tradelines[0]?.payment_history, 'Times late 30/60/90: 1/0/0')
  })

  it('does not keep Unnamed locals when Gemini has equal count of real names', () => {
    const local = emptyReport()
    local.tradelines = [
      {
        id: 'u1',
        creditor: 'Unnamed · Credit Card 1111',
        account_tu: '1111XXXX',
        account_exp: '',
        account_eqf: '',
        account_type: 'Credit Card',
        status: 'Open',
        balance: '$10',
        past_due: '',
        remarks: '',
        credit_limit: '',
        high_credit: '',
        date_opened: '',
        date_of_first_delinquency: '',
        last_reported: '',
        payment_history: '',
        monthly_payment: '',
        bureaus: ['TUC'],
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
      },
    ]
    const next = applyGeminiRead(local, {
      scores: {},
      tradelines: [
        {
          id: 'g1',
          creditor: 'CAPITAL ONE',
          account_tu: '1111XXXX',
          account_exp: '',
          account_eqf: '',
          account_type: 'Credit Card',
          status: 'Open',
          balance: '$10',
          past_due: '',
          remarks: '',
          credit_limit: '',
          high_credit: '',
          date_opened: '',
          date_of_first_delinquency: '',
          last_reported: '',
          payment_history: '',
          monthly_payment: '',
          bureaus: ['TUC'],
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
        },
      ],
    })
    assert.equal(next.tradelines[0]?.creditor, 'CAPITAL ONE')
  })
})

describe('readReportWithGemini', () => {
  it('does not call the model when the key is missing', async () => {
    const previous = process.env.GEMINI_API_KEY
    delete process.env.GEMINI_API_KEY
    let called = false
    const read = await readReportWithGemini({
      bytes: Buffer.from('pdf'),
      mimeType: 'application/pdf',
      fileName: 'scan.pdf',
      fetchImpl: (async () => {
        called = true
        return new Response('{}')
      }) as typeof fetch,
    })
    if (previous === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = previous
    assert.equal(called, false)
    assert.deepEqual(read.tradelines, [])
  })

  it('sends the file with a short timeout and reads the JSON text', async () => {
    const previous = process.env.GEMINI_API_KEY
    process.env.GEMINI_API_KEY = 'test-key'
    let sawTimeout = false
    const read = await readReportWithGemini({
      bytes: Buffer.from('pdf-bytes'),
      mimeType: 'application/pdf',
      fileName: 'scan.pdf',
      timeoutMs: 20_000,
      fetchImpl: (async (_url, init) => {
        sawTimeout = init?.signal instanceof AbortSignal
        assert.equal(new Headers(init?.headers).get('x-goog-api-key'), 'test-key')
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        scores: { exp: 640 },
                        tradelines: [
                          {
                            creditor: 'NORTH BANK',
                            account_number: '1111',
                            status: 'Open',
                            balance: '$10',
                            bureaus: ['EXP'],
                          },
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
          })
        )
      }) as typeof fetch,
    })
    if (previous === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = previous
    assert.equal(sawTimeout, true)
    assert.equal(read.tradelines[0]?.creditor, 'NORTH BANK')
    assert.equal(geminiReportMimeType('report.PDF'), 'application/pdf')
    assert.equal(geminiReportMimeType('notes.html'), null)
  })
})
