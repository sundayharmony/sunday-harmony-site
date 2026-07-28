import { writeFileSync } from 'fs'
import type { CreditIntelligenceReport } from '../dispute-letters/types'
import {
  creditIntelligencePdfFilename,
  renderCreditIntelligencePdf,
} from '../credit-intelligence-pdf-server'

const sample: CreditIntelligenceReport = {
  version: '1.0',
  analyzed_at: '2026-07-28T12:00:00.000Z',
  report_date: '07/24/2026',
  consumer_name: 'Michael Webb',
  factors: [
    {
      factor: 'payment_history',
      weight_hint: 0.35,
      summary: 'Mixed payment history with a few aged negatives.',
      score_band: 'mixed',
      findings: [],
      metrics: {},
      strengths: ['Several accounts current'],
      weaknesses: ['1 collection present'],
      recommendations: [],
    },
    {
      factor: 'revolving_utilization',
      weight_hint: 0.3,
      summary: 'Aggregate utilization approximately 42%.',
      score_band: 'elevated',
      findings: [],
      metrics: { aggregate_utilization: 0.42 },
      strengths: [],
      weaknesses: ['Elevated revolving use'],
      recommendations: ['Pay down highest-util cards'],
    },
  ],
  overall: {
    band: 'fair',
    narrative: 'Overall profile band: fair (avg reported score ≈ 645).',
    strengths: ['Installment diversity present', 'No public records identified'],
    weaknesses: ['1 collection(s) are high-priority profile risks'],
    risk_factors: ['1 derogatory tradeline(s) remain on the file'],
    improvement_priorities: ['Address collections', 'Lower revolving utilization'],
    average_score: 645,
  },
  funding_readiness: {
    level: 'developing',
    score_0_to_100: 48,
    summary: 'Funding readiness indicator: developing (48/100).',
    blockers: ['Open collections are a common underwriting red flag.'],
    supportive_signals: ['Inquiry activity appears limited.'],
    practical_steps: [
      'Clear or dispute inaccurate collections before packaging funding applications.',
      'These readiness notes are educational indicators only.',
    ],
  },
  recommendations: [
    {
      id: 'rec_1',
      title: 'Reduce revolving utilization',
      category: 'utilization',
      rationale: 'Amounts-owed factors are a major educational score driver.',
      estimated_impact: 0.8,
      confidence: 0.75,
      priority_score: 0.6,
      suggested_actions: ['Pay down highest utilization cards', 'Request CLI where appropriate'],
      related_tradeline_ids: [],
      legal_basis: '',
    },
  ],
  account_dispute_insights: [],
  recommended_next_steps: [
    'Address collections',
    'Lower revolving utilization',
    'Continue on-time payments',
  ],
  disclaimer:
    'Educational analysis only. Not a FICO Score, credit counseling substitute, or legal advice.',
}

async function main() {
  const buf = await renderCreditIntelligencePdf(sample)
  const name = creditIntelligencePdfFilename(sample)
  if (!buf.subarray(0, 5).toString().startsWith('%PDF-')) {
    throw new Error('Output is not a PDF')
  }
  if (buf.length < 1000) {
    throw new Error(`PDF too small: ${buf.length}`)
  }
  writeFileSync(`/tmp/${name}`, buf)
  console.log(JSON.stringify({ ok: true, filename: name, bytes: buf.length }))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
