import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  comparisonKeysFromSessions,
  followUpResponseNote,
  followUpSessionsAfterRound1,
  pickHistoricalRound1Session,
  selectTradelinesForHistoricalRound1,
} from '../dispute-letters/round1-backfill'
import type { BureauScores, CreditIntelligenceReport, DisputeSessionListItem, Tradeline } from '../dispute-letters/types'

function intelligence(reportDate: string): CreditIntelligenceReport {
  return {
    version: '1',
    analyzed_at: `${reportDate}T12:00:00.000Z`,
    report_date: reportDate,
    consumer_name: 'Mike Webb',
    factors: [],
    overall: {
      band: 'fair',
      narrative: '',
      strengths: [],
      weaknesses: [],
      risk_factors: [],
      improvement_priorities: [],
      average_score: 640,
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
}

function tradeline(partial: Partial<Tradeline> & Pick<Tradeline, 'id' | 'creditor'>): Tradeline {
  return {
    account_tu: '',
    account_exp: '',
    account_eqf: '',
    account_type: 'Collection',
    status: 'Collection',
    balance: '$100',
    past_due: '',
    remarks: '',
    bureaus: ['TUC'],
    is_collection: true,
    selected: false,
    dispute_reason: '',
    analysis_notes: '',
    suggested_dispute_reason: 'Unverifiable collection',
    dispute_bureaus: partial.bureaus || ['TUC'],
    dispute_furnisher: false,
    legal_flags: [],
    repair_priority: 'high',
    item_category: 'collection',
    ...partial,
  }
}

function session(params: {
  id: string
  fileName: string
  reportDate: string
  scores?: Partial<BureauScores>
  tradelines?: Tradeline[]
  createdAt?: string
}): DisputeSessionListItem {
  const intel = intelligence(params.reportDate)
  return {
    id: params.id,
    admin_user_id: 'admin',
    status: 'ready',
    storage_path: `path/${params.id}`,
    file_name: params.fileName,
    file_type: 'application/pdf',
    report_json: {
      source: 'test',
      reference: params.id,
      report_date: params.reportDate,
      analysis_summary: '',
      credit_health: {
        scores: {
          tuc: params.scores?.tuc ?? null,
          exp: params.scores?.exp ?? null,
          eqf: params.scores?.eqf ?? null,
        },
        total_accounts: 2,
        negative_count: 2,
        collection_count: 2,
        high_priority_count: 2,
        repair_summary: '',
        recommended_actions: [],
      },
      credit_intelligence: intel,
      consumer: { name: 'Mike Webb', dob: '', ssn_last4: '', addresses: [] },
      tradelines: params.tradelines || [],
      subscribers: [],
      file_type: 'pdf',
      ocr_used: false,
      extraction_quality: 'high',
    },
    error_message: null,
    application_uuid: 'app-mike',
    intelligence_json: intel,
    created_at: params.createdAt || `${params.reportDate}T12:00:00.000Z`,
    updated_at: `${params.reportDate}T12:00:00.000Z`,
  }
}

const kikoffAll = tradeline({
  id: 'kikoff',
  creditor: 'KIKOFF',
  account_tu: '****1111',
  account_exp: '****1111',
  account_eqf: '****1111',
  bureaus: ['TUC', 'EXP', 'EQF'],
  dispute_bureaus: ['TUC', 'EXP', 'EQF'],
})
const capOneTu = tradeline({
  id: 'cap-tu',
  creditor: 'CAPITAL ONE',
  account_tu: '****2222',
  bureaus: ['TUC'],
})
const capOneExpGone = tradeline({
  id: 'cap-exp',
  creditor: 'CAPITAL ONE',
  account_exp: '****2222',
  bureaus: ['EXP'],
})

const triMerge = session({
  id: 'tri',
  fileName: 'Mike Webb 3-Bureau Credit Report & Scores.pdf',
  reportDate: '2026-07-24',
  scores: { tuc: 640, exp: 627, eqf: 661 },
  tradelines: [kikoffAll, capOneTu, capOneExpGone],
})
const transunion = session({
  id: 'tu-aug',
  fileName: 'Mike Webb Transunion 8-24-2026.pdf',
  reportDate: '2026-08-24',
  scores: { tuc: 712 },
  tradelines: [kikoffAll, capOneTu],
})
const equifax = session({
  id: 'eqf-aug',
  fileName: 'Mike Webb Equifax 8-24-2026.pdf',
  reportDate: '2026-08-24',
  scores: { eqf: 779 },
  tradelines: [{ ...kikoffAll, bureaus: ['EQF'], dispute_bureaus: ['EQF'] }],
})
const experian = session({
  id: 'exp-sep',
  fileName: 'Mike Webb Experian 9-12-2026.pdf',
  reportDate: '2026-09-11',
  scores: { exp: 699 },
  tradelines: [{ ...kikoffAll, bureaus: ['EXP'], dispute_bureaus: ['EXP'] }],
})

describe('historical Round 1 backfill helpers', () => {
  it('picks the July 24 3-bureau report as Round 1', () => {
    const picked = pickHistoricalRound1Session([experian, equifax, transunion, triMerge])
    assert.equal(picked?.id, 'tri')
    assert.equal(picked?.file_name.includes('3-Bureau'), true)
  })

  it('matches July 24 even when the stored year differs', () => {
    const olderYear = session({
      id: 'tri-2025',
      fileName: 'Mike Webb 3-Bureau Credit Report & Scores.pdf',
      reportDate: '2025-07-24',
      tradelines: [kikoffAll],
    })
    const picked = pickHistoricalRound1Session([experian, olderYear], '2026-07-24')
    assert.equal(picked?.id, 'tri-2025')
  })

  it('labels a single-bureau follow-up from the filename', () => {
    assert.match(followUpResponseNote(experian), /Experian/)
    assert.match(followUpResponseNote(transunion), /TransUnion/)
  })

  it('treats later bureau PDFs as Round 1 follow-ups', () => {
    const followUps = followUpSessionsAfterRound1([experian, equifax, transunion, triMerge], triMerge)
    assert.deepEqual(followUps.map((row) => row.id).sort(), ['eqf-aug', 'exp-sep', 'tu-aug'])
  })

  it('selects letter-plan accounts when those plans exist', () => {
    const selected = selectTradelinesForHistoricalRound1(triMerge.report_json?.tradelines || [], [
      {
        items: [{ tradeline_id: 'kikoff', creditor: 'KIKOFF', account_number: '1111', bureau: 'EXP' }],
      },
    ])
    assert.equal(selected.find((row) => row.id === 'kikoff')?.selected, true)
    assert.equal(selected.find((row) => row.id === 'cap-tu')?.selected, false)
  })

  it('falls back to recommended disputes when no letter plan is stored', () => {
    const selected = selectTradelinesForHistoricalRound1(triMerge.report_json?.tradelines || [], [])
    assert.equal(selected.every((row) => row.selected), true)
  })

  it('compares each bureau against its own latest report instead of the newest PDF only', () => {
    const { matchKeys } = comparisonKeysFromSessions([experian, equifax, transunion, triMerge])
    assert.equal(matchKeys.has('c4:TUC:kikoff:1111'), true)
    assert.equal(matchKeys.has('c4:EQF:kikoff:1111'), true)
    assert.equal(matchKeys.has('c4:EXP:kikoff:1111'), true)
    assert.equal(matchKeys.has('c4:TUC:capital one:2222'), true)
    assert.equal(matchKeys.has('c4:EXP:capital one:2222'), false)
  })
})
