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

/** Coerce unknown values to plain text — prevents React #31 from non-string children. */
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

function BulletList({ items, limit = 8 }: { items: string[]; limit?: number }) {
  const list = asTextList(items).slice(0, limit)
  if (!list.length) {
    return <Text style={styles.listItem}>None noted.</Text>
  }
  return (
    <View>
      {list.map((item, index) => (
        <Text key={`${index}-${item.slice(0, 24)}`} style={styles.listItem}>
          {`• ${item}`}
        </Text>
      ))}
    </View>
  )
}

function FactorBlock({ factor }: { factor: FactorAnalysis }) {
  const label = asText(FACTOR_LABELS[factor.factor] || factor.factor, 'Factor')
  return (
    <View style={styles.card} wrap={false}>
      <View style={styles.cardTitleRow}>
        <Text style={styles.cardTitle}>{label}</Text>
        <Text style={styles.cardBand}>{formatBand(factor.score_band)}</Text>
      </View>
      <Text style={styles.cardBody}>{asText(factor.summary)}</Text>
    </View>
  )
}

function RecommendationBlock({ rec }: { rec: Recommendation }) {
  const actions = asTextList(rec.suggested_actions).slice(0, 4)
  return (
    <View style={styles.recBlock} wrap={false}>
      <Text style={styles.recTitle}>{asText(rec.title, 'Recommendation')}</Text>
      <Text style={styles.recMeta}>
        {`Impact ${impactPct(rec.estimated_impact)} · Confidence ${impactPct(rec.confidence)}`}
      </Text>
      <Text style={styles.cardBody}>{asText(rec.rationale)}</Text>
      {actions.map((action, index) => (
        <Text key={`${index}-${action.slice(0, 24)}`} style={styles.listItem}>
          {`• ${action}`}
        </Text>
      ))}
    </View>
  )
}

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
  const scoreSuffix = averageScore != null ? `  ·  ~${averageScore}` : ''

  const blockers = asTextList(funding?.blockers)
  const supportive = asTextList(funding?.supportive_signals)
  const practical = asTextList(funding?.practical_steps)
  const nextSteps = asTextList(report.recommended_next_steps)
  const factors = Array.isArray(report.factors) ? report.factors : []
  const recommendations = Array.isArray(report.recommendations)
    ? report.recommendations.slice(0, 10)
    : []

  return (
    <Document
      title={`Credit Profile Analysis — ${consumerName}`}
      author="Sunday Harmony"
      subject="Credit Profile Analysis"
      creator="Sunday Harmony Credit Intelligence"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerBar}>
          <Text style={styles.brand}>Sunday Harmony</Text>
          <Text style={styles.title}>Credit Profile Analysis</Text>
          <Text style={styles.meta}>{metaParts.join('  ·  ')}</Text>
        </View>

        <View style={styles.bandRow}>
          <Text style={styles.bandPill}>{`${bandLabel}${scoreSuffix}`}</Text>
        </View>
        {narrative ? <Text style={styles.narrative}>{narrative}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Strengths & Risks</Text>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.boldLabel}>Strengths</Text>
              <BulletList items={strengths} />
            </View>
            <View style={styles.colLast}>
              <Text style={styles.boldLabel}>Weaknesses & risks</Text>
              <BulletList items={weaknesses} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Funding Readiness</Text>
          <View style={styles.card} wrap={false}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>
                {`${formatBand(funding?.level)} · ${asText(funding?.score_0_to_100, '0')}/100`}
              </Text>
            </View>
            <Text style={styles.cardBody}>{asText(funding?.summary)}</Text>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.boldLabel}>Blockers</Text>
              <BulletList
                items={blockers.length ? blockers : ['None flagged from available data.']}
              />
            </View>
            <View style={styles.colLast}>
              <Text style={styles.boldLabel}>Supportive signals</Text>
              <BulletList
                items={
                  supportive.length
                    ? supportive
                    : ['Limited supportive signals in current extract.']
                }
              />
            </View>
          </View>
          {practical.length ? (
            <View style={styles.spacedBlock}>
              <Text style={styles.boldLabel}>Practical next steps</Text>
              <BulletList items={practical} limit={6} />
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Factor Analysis</Text>
          {factors.map((factor, index) => (
            <FactorBlock key={`${asText(factor.factor, 'factor')}-${index}`} factor={factor} />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prioritized Recommendations</Text>
          {recommendations.map((rec, index) => (
            <RecommendationBlock key={`${asText(rec.id, 'rec')}-${index}`} rec={rec} />
          ))}
        </View>

        {nextSteps.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommended Next Steps</Text>
            {nextSteps.map((step, index) => (
              <Text key={`${index}-${step.slice(0, 24)}`} style={styles.stepItem}>
                {`${index + 1}. ${step}`}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.disclaimer}>
            {asText(
              report.disclaimer,
              'Educational analysis only. Not a credit score calculation, credit counseling substitute, or legal advice. Does not guarantee score changes, deletions, or financing approval.'
            )}
          </Text>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}
