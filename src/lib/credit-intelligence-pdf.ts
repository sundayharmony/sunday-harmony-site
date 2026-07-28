import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import {
  FACTOR_LABELS,
  type CreditIntelligenceReport,
  type FactorAnalysis,
  type Recommendation,
} from '@/lib/dispute-letters/types'

const colors = {
  text: '#1a1a1a',
  muted: '#5c5c5c',
  dim: '#8a8a8a',
  border: '#e5e2dc',
  accent: '#b8943f',
  accentSoft: '#f0ebe3',
  white: '#ffffff',
  softBg: '#faf9f7',
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: colors.text,
    backgroundColor: colors.white,
  },
  headerBar: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
    paddingBottom: 12,
    marginBottom: 18,
  },
  brand: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
    color: colors.text,
  },
  meta: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 9,
  },
  bandRow: {
    marginTop: 14,
    marginBottom: 10,
  },
  bandPill: {
    backgroundColor: colors.accentSoft,
    color: colors.accent,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    paddingVertical: 4,
    paddingHorizontal: 8,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },
  narrative: {
    color: colors.muted,
    lineHeight: 1.45,
    marginBottom: 14,
  },
  section: {
    marginTop: 14,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.text,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  twoCol: {
    flexDirection: 'row',
  },
  col: {
    flex: 1,
    paddingRight: 8,
  },
  colLast: {
    flex: 1,
    paddingLeft: 8,
  },
  listItem: {
    marginBottom: 4,
    color: colors.muted,
    lineHeight: 1.35,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
    backgroundColor: colors.softBg,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: colors.text,
    flex: 1,
    paddingRight: 8,
  },
  cardBand: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.accent,
    textTransform: 'uppercase',
  },
  cardBody: {
    color: colors.muted,
    lineHeight: 1.35,
  },
  recBlock: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  recTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 3,
  },
  recMeta: {
    fontSize: 8,
    color: colors.dim,
    marginBottom: 3,
  },
  stepItem: {
    marginBottom: 4,
    color: colors.muted,
  },
  footer: {
    marginTop: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  disclaimer: {
    fontSize: 8,
    color: colors.dim,
    lineHeight: 1.4,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: colors.dim,
    textAlign: 'center',
  },
  boldLabel: {
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  spacedBlock: {
    marginTop: 8,
  },
})

function asText(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => asText(v)).filter((v) => v.length > 0)
}

function formatBand(band: unknown) {
  return asText(band).replace(/_/g, ' ')
}

function formatDateLabel(value?: string) {
  const raw = asText(value)
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function impactPct(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '0%'
  return `${Math.round(Math.min(1, Math.max(0, n)) * 100)}%`
}

function bulletList(items: string[], limit = 8) {
  const list = asTextList(items).slice(0, limit)
  if (!list.length) {
    return React.createElement(Text, { style: styles.listItem }, 'None noted.')
  }
  return React.createElement(
    View,
    null,
    ...list.map((item, index) =>
      React.createElement(
        Text,
        { key: `${index}-${item.slice(0, 24)}`, style: styles.listItem },
        `- ${item}`
      )
    )
  )
}

function factorBlock(factor: FactorAnalysis, index: number) {
  const label = asText(FACTOR_LABELS[factor.factor] || factor.factor, 'Factor')
  return React.createElement(
    View,
    { key: `${asText(factor.factor, 'factor')}-${index}`, style: styles.card, wrap: false },
    React.createElement(
      View,
      { style: styles.cardTitleRow },
      React.createElement(Text, { style: styles.cardTitle }, label),
      React.createElement(Text, { style: styles.cardBand }, formatBand(factor.score_band))
    ),
    React.createElement(Text, { style: styles.cardBody }, asText(factor.summary))
  )
}

function recommendationBlock(rec: Recommendation, index: number) {
  const actions = asTextList(rec.suggested_actions).slice(0, 4)
  return React.createElement(
    View,
    { key: `${asText(rec.id, 'rec')}-${index}`, style: styles.recBlock, wrap: false },
    React.createElement(Text, { style: styles.recTitle }, asText(rec.title, 'Recommendation')),
    React.createElement(
      Text,
      { style: styles.recMeta },
      `Impact ${impactPct(rec.estimated_impact)} / Confidence ${impactPct(rec.confidence)}`
    ),
    React.createElement(Text, { style: styles.cardBody }, asText(rec.rationale)),
    ...actions.map((action, actionIndex) =>
      React.createElement(
        Text,
        { key: `${actionIndex}-${action.slice(0, 24)}`, style: styles.listItem },
        `- ${action}`
      )
    )
  )
}

/**
 * Built with React.createElement only (no JSX) so Next's automatic JSX runtime
 * cannot inject react/jsx-runtime elements into @react-pdf's reconciler.
 * That mismatch is what produced production React error #31 on PDF download.
 */
export function CreditIntelligencePdfDocument({
  report,
}: {
  report: CreditIntelligenceReport
}) {
  const overall = report.overall
  const funding = report.funding_readiness
  const strengths = asTextList(overall?.strengths)
  const weaknesses = [...asTextList(overall?.weaknesses), ...asTextList(overall?.risk_factors)]
  const consumerName = asText(report.consumer_name, 'Client')
  const narrative = asText(overall?.narrative)
  const averageScore =
    typeof overall?.average_score === 'number' ? overall.average_score : null

  const metaParts = [
    consumerName,
    report.report_date ? `Report ${asText(report.report_date)}` : '',
    report.analyzed_at ? `Analyzed ${formatDateLabel(report.analyzed_at)}` : '',
  ].filter(Boolean)

  const bandLabel = formatBand(overall?.band)
  const scoreSuffix = averageScore != null ? `  /  ~${averageScore}` : ''

  const blockers = asTextList(funding?.blockers)
  const supportive = asTextList(funding?.supportive_signals)
  const practical = asTextList(funding?.practical_steps)
  const nextSteps = asTextList(report.recommended_next_steps)
  const factors = Array.isArray(report.factors) ? report.factors : []
  const recommendations = Array.isArray(report.recommendations)
    ? report.recommendations.slice(0, 10)
    : []

  const children: React.ReactNode[] = [
    React.createElement(
      View,
      { key: 'header', style: styles.headerBar },
      React.createElement(Text, { style: styles.brand }, 'Sunday Harmony'),
      React.createElement(Text, { style: styles.title }, 'Credit Profile Analysis'),
      React.createElement(Text, { style: styles.meta }, metaParts.join('  |  '))
    ),
    React.createElement(
      View,
      { key: 'band', style: styles.bandRow },
      React.createElement(Text, { style: styles.bandPill }, `${bandLabel}${scoreSuffix}`)
    ),
  ]

  if (narrative) {
    children.push(React.createElement(Text, { key: 'narrative', style: styles.narrative }, narrative))
  }

  children.push(
    React.createElement(
      View,
      { key: 'strengths-risks', style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, 'Strengths & Risks'),
      React.createElement(
        View,
        { style: styles.twoCol },
        React.createElement(
          View,
          { style: styles.col },
          React.createElement(Text, { style: styles.boldLabel }, 'Strengths'),
          bulletList(strengths)
        ),
        React.createElement(
          View,
          { style: styles.colLast },
          React.createElement(Text, { style: styles.boldLabel }, 'Weaknesses & risks'),
          bulletList(weaknesses)
        )
      )
    ),
    React.createElement(
      View,
      { key: 'funding', style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, 'Funding Readiness'),
      React.createElement(
        View,
        { style: styles.card, wrap: false },
        React.createElement(
          View,
          { style: styles.cardTitleRow },
          React.createElement(
            Text,
            { style: styles.cardTitle },
            `${formatBand(funding?.level)} / ${asText(funding?.score_0_to_100, '0')}/100`
          )
        ),
        React.createElement(Text, { style: styles.cardBody }, asText(funding?.summary))
      ),
      React.createElement(
        View,
        { style: styles.twoCol },
        React.createElement(
          View,
          { style: styles.col },
          React.createElement(Text, { style: styles.boldLabel }, 'Blockers'),
          bulletList(blockers.length ? blockers : ['None flagged from available data.'])
        ),
        React.createElement(
          View,
          { style: styles.colLast },
          React.createElement(Text, { style: styles.boldLabel }, 'Supportive signals'),
          bulletList(
            supportive.length
              ? supportive
              : ['Limited supportive signals in current extract.']
          )
        )
      ),
      practical.length
        ? React.createElement(
            View,
            { style: styles.spacedBlock },
            React.createElement(Text, { style: styles.boldLabel }, 'Practical next steps'),
            bulletList(practical, 6)
          )
        : null
    ),
    React.createElement(
      View,
      { key: 'factors', style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, 'Factor Analysis'),
      ...factors.map((factor, index) => factorBlock(factor, index))
    ),
    React.createElement(
      View,
      { key: 'recs', style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, 'Prioritized Recommendations'),
      ...recommendations.map((rec, index) => recommendationBlock(rec, index))
    )
  )

  if (nextSteps.length) {
    children.push(
      React.createElement(
        View,
        { key: 'next-steps', style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Recommended Next Steps'),
        ...nextSteps.map((step, index) =>
          React.createElement(
            Text,
            { key: `${index}-${step.slice(0, 24)}`, style: styles.stepItem },
            `${index + 1}. ${step}`
          )
        )
      )
    )
  }

  children.push(
    React.createElement(
      View,
      { key: 'footer', style: styles.footer },
      React.createElement(
        Text,
        { style: styles.disclaimer },
        asText(
          report.disclaimer,
          'Educational analysis only. Not a credit score calculation, credit counseling substitute, or legal advice. Does not guarantee score changes, deletions, or financing approval.'
        )
      )
    ),
    React.createElement(Text, {
      key: 'page-number',
      style: styles.pageNumber,
      fixed: true,
      render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
        `Page ${pageNumber} of ${totalPages}`,
    })
  )

  return React.createElement(
    Document,
    {
      title: `Credit Profile Analysis - ${consumerName}`,
      author: 'Sunday Harmony',
      subject: 'Credit Profile Analysis',
      creator: 'Sunday Harmony Credit Intelligence',
    },
    React.createElement(Page, { size: 'LETTER', style: styles.page }, ...children)
  )
}
