import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  bureauScoreOriginNote,
  hasAnyBureauScore,
  latestBureauScoreSources,
  resolveBureauScoresAcrossReports,
} from '../dispute-letters/bureau-score-history'
import type {
  BureauScores,
  CreditIntelligenceReport,
  DisputeSessionListItem,
  DisputeSessionStatus,
} from '../dispute-letters/types'

function intelligence(reportDate: string, averageScore: number | null): CreditIntelligenceReport {
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
      average_score: averageScore,
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

function session(params: {
  id: string
  fileName: string
  reportDate: string
  scores?: Partial<BureauScores>
  averageScore?: number | null
  status?: DisputeSessionStatus
  withIntelligence?: boolean
}): DisputeSessionListItem {
  const intel =
    params.withIntelligence === false
      ? null
      : intelligence(params.reportDate, params.averageScore ?? null)
  return {
    id: params.id,
    admin_user_id: 'admin',
    status: params.status || 'ready',
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
        total_accounts: 10,
        negative_count: 3,
        collection_count: 1,
        high_priority_count: 1,
        repair_summary: '',
        recommended_actions: [],
      },
      credit_intelligence: intel,
      consumer: { name: 'Mike Webb', dob: '', ssn_last4: '', addresses: [] },
      tradelines: [],
      subscribers: [],
      file_type: 'pdf',
      ocr_used: false,
      extraction_quality: 'high',
    },
    error_message: null,
    application_uuid: 'app-1',
    intelligence_json: intel,
    created_at: `${params.reportDate}T12:00:00.000Z`,
    updated_at: `${params.reportDate}T12:00:00.000Z`,
  }
}

const triMerge = session({
  id: 'tri',
  fileName: 'Mike Webb 3-Bureau Credit Report & Scores.pdf',
  reportDate: '2026-07-24',
  scores: { tuc: 640, exp: 627, eqf: 661 },
})

const transunionOnly = session({
  id: 'tu-aug',
  fileName: 'Mike Webb Transunion 8-24-2026.pdf',
  reportDate: '2026-08-24',
  scores: { tuc: 712 },
})

const equifaxOnly = session({
  id: 'eqf-aug',
  fileName: 'Mike Webb Equifax 8-24-2026.pdf',
  reportDate: '2026-08-24',
  scores: { eqf: 779 },
})

const experianOnly = session({
  id: 'exp-sep',
  fileName: 'Mike Webb Experian 9-12-2026.pdf',
  reportDate: '2026-09-11',
  scores: { exp: 699 },
})

const mikeWebbSessions = [experianOnly, equifaxOnly, transunionOnly, triMerge]

describe('latestBureauScoreSources', () => {
  it('tracks the newest score per bureau across single-bureau uploads', () => {
    const sources = latestBureauScoreSources(mikeWebbSessions)
    assert.equal(sources.TUC?.score, 712)
    assert.equal(sources.TUC?.session_id, 'tu-aug')
    assert.equal(sources.EQF?.score, 779)
    assert.equal(sources.EQF?.session_id, 'eqf-aug')
    assert.equal(sources.EXP?.score, 699)
    assert.equal(sources.EXP?.session_id, 'exp-sep')
  })

  it('ignores reports that are not ready', () => {
    const pending = session({
      id: 'pending',
      fileName: 'Mike Webb Experian 10-2026.pdf',
      reportDate: '2026-10-01',
      scores: { exp: 730 },
      status: 'analyzing',
    })
    const sources = latestBureauScoreSources([...mikeWebbSessions, pending])
    assert.equal(sources.EXP?.score, 699)
  })

  it('falls back to the intelligence average for a single-bureau upload with no extracted score', () => {
    const noScoreBlock = session({
      id: 'exp-oct',
      fileName: 'Mike Webb Experian 10-15-2026.pdf',
      reportDate: '2026-10-15',
      averageScore: 705,
    })
    const sources = latestBureauScoreSources([...mikeWebbSessions, noScoreBlock])
    assert.equal(sources.EXP?.score, 705)
    assert.equal(sources.EXP?.session_id, 'exp-oct')
  })
})

describe('resolveBureauScoresAcrossReports', () => {
  it('fills bureaus the selected report does not cover from the newest other report', () => {
    const { scores, origins } = resolveBureauScoresAcrossReports({
      sessions: mikeWebbSessions,
      selectedSessionId: 'exp-sep',
    })
    assert.equal(scores.exp, 699)
    assert.equal(scores.tuc, 712)
    assert.equal(scores.eqf, 779)
    assert.equal(origins.EXP?.from_selected_report, true)
    assert.equal(origins.TUC?.from_selected_report, false)
    assert.equal(origins.TUC?.file_name, 'Mike Webb Transunion 8-24-2026.pdf')
    assert.equal(origins.EQF?.report_date, '2026-08-24')
  })

  it('prefers the selected report over newer scores from other reports', () => {
    const { scores, origins } = resolveBureauScoresAcrossReports({
      sessions: mikeWebbSessions,
      selectedSessionId: 'tri',
    })
    assert.equal(scores.tuc, 640)
    assert.equal(scores.exp, 627)
    assert.equal(scores.eqf, 661)
    assert.equal(origins.EXP?.from_selected_report, true)
  })

  it('uses scores passed in for the selected report and carries the rest forward', () => {
    const { scores, origins } = resolveBureauScoresAcrossReports({
      sessions: mikeWebbSessions,
      selectedSessionId: 'exp-sep',
      selectedScores: { tuc: null, exp: 699, eqf: null },
    })
    assert.equal(scores.exp, 699)
    assert.equal(scores.tuc, 712)
    assert.equal(origins.EQF?.session_id, 'eqf-aug')
  })

  it('still credits the selected report when its score only comes from the intelligence average', () => {
    const noScoreBlock = session({
      id: 'exp-oct',
      fileName: 'Mike Webb Experian 10-15-2026.pdf',
      reportDate: '2026-10-15',
      averageScore: 705,
    })
    const { scores, origins } = resolveBureauScoresAcrossReports({
      sessions: [...mikeWebbSessions, noScoreBlock],
      selectedSessionId: 'exp-oct',
      selectedScores: { tuc: null, exp: null, eqf: null },
    })
    assert.equal(scores.exp, 705)
    assert.equal(origins.EXP?.from_selected_report, true)
    assert.equal(origins.TUC?.from_selected_report, false)
  })

  it('returns empty scores when nothing is uploaded', () => {
    const { scores, origins } = resolveBureauScoresAcrossReports({
      sessions: [],
      selectedSessionId: null,
    })
    assert.deepEqual(scores, { tuc: null, exp: null, eqf: null })
    assert.deepEqual(origins, {})
    assert.equal(hasAnyBureauScore(scores), false)
  })

  it('ignores out-of-range values so bad extracts never surface as scores', () => {
    const bogus = session({
      id: 'bogus',
      fileName: 'Mike Webb Experian bad.pdf',
      reportDate: '2026-10-20',
      scores: { exp: 12 },
    })
    const { scores } = resolveBureauScoresAcrossReports({
      sessions: [bogus],
      selectedSessionId: 'bogus',
    })
    assert.equal(scores.exp, null)
  })
})

describe('bureauScoreOriginNote', () => {
  it('names the report a carried-forward score came from', () => {
    const { origins } = resolveBureauScoresAcrossReports({
      sessions: mikeWebbSessions,
      selectedSessionId: 'exp-sep',
    })
    assert.equal(bureauScoreOriginNote(origins.TUC), 'From Aug 24, 2026 report')
    assert.equal(bureauScoreOriginNote(origins.EXP), null)
    assert.equal(bureauScoreOriginNote(undefined), null)
  })
})
