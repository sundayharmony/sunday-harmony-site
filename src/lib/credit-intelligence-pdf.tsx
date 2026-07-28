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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    gap: 12,
  },
  col: {
    flex: 1,
  },
  listItem: {
    marginBottom: 4,
    color: colors.muted,
    lineHeight: 1.35,
  },
  bullet: {
    color: colors.accent,
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
})

function formatBand(band: string) {
  return band.replace(/_/g, ' ')
}

function formatDateLabel(value?: string) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function impactPct(value: number) {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`
}

function BulletList({ items, limit = 8 }: { items: string[]; limit?: number }) {
  if (!items.length) {
    return <Text style={styles.listItem}>None noted.</Text>
  }
  return (
    <>
      {items.slice(0, limit).map((item) => (
        <Text key={item} style={styles.listItem}>
          <Text style={styles.bullet}>• </Text>
          {item}
        </Text>
      ))}
    </>
  )
}

function FactorBlock({ factor }: { factor: FactorAnalysis }) {
  const label = FACTOR_LABELS[factor.factor] || factor.factor
  return (
    <View style={styles.card} wrap={false}>
      <View style={styles.cardTitleRow}>
        <Text style={styles.cardTitle}>{label}</Text>
        <Text style={styles.cardBand}>{formatBand(factor.score_band)}</Text>
      </View>
      <Text style={styles.cardBody}>{factor.summary}</Text>
    </View>
  )
}

function RecommendationBlock({ rec }: { rec: Recommendation }) {
  return (
    <View style={styles.recBlock} wrap={false}>
      <Text style={styles.recTitle}>{rec.title}</Text>
      <Text style={styles.recMeta}>
        Impact {impactPct(rec.estimated_impact)} · Confidence {impactPct(rec.confidence)}
      </Text>
      <Text style={styles.cardBody}>{rec.rationale}</Text>
      {rec.suggested_actions.slice(0, 4).map((action) => (
        <Text key={action} style={styles.listItem}>
          <Text style={styles.bullet}>• </Text>
          {action}
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
  const weaknesses = [...(overall.weaknesses || []), ...(overall.risk_factors || [])]

  const metaParts = [
    report.consumer_name || 'Client',
    report.report_date ? `Report ${report.report_date}` : '',
    report.analyzed_at ? `Analyzed ${formatDateLabel(report.analyzed_at)}` : '',
  ].filter(Boolean)

  return (
    <Document
      title={`Credit Profile Analysis — ${report.consumer_name || 'Client'}`}
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
          <Text style={styles.bandPill}>
            {formatBand(overall.band)}
            {overall.average_score != null ? `  ·  ~${overall.average_score}` : ''}
          </Text>
        </View>
        {overall.narrative ? <Text style={styles.narrative}>{overall.narrative}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Strengths & Risks</Text>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Strengths</Text>
              <BulletList items={overall.strengths || []} />
            </View>
            <View style={styles.col}>
              <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Weaknesses & risks</Text>
              <BulletList items={weaknesses} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Funding Readiness</Text>
          <View style={styles.card} wrap={false}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>
                {formatBand(funding.level)} · {funding.score_0_to_100}/100
              </Text>
            </View>
            <Text style={styles.cardBody}>{funding.summary}</Text>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Blockers</Text>
              <BulletList
                items={
                  funding.blockers?.length
                    ? funding.blockers
                    : ['None flagged from available data.']
                }
              />
            </View>
            <View style={styles.col}>
              <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Supportive signals</Text>
              <BulletList
                items={
                  funding.supportive_signals?.length
                    ? funding.supportive_signals
                    : ['Limited supportive signals in current extract.']
                }
              />
            </View>
          </View>
          {funding.practical_steps?.length ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Practical next steps</Text>
              <BulletList items={funding.practical_steps} limit={6} />
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Factor Analysis</Text>
          {(report.factors || []).map((factor) => (
            <FactorBlock key={factor.factor} factor={factor} />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prioritized Recommendations</Text>
          {(report.recommendations || []).slice(0, 10).map((rec) => (
            <RecommendationBlock key={rec.id} rec={rec} />
          ))}
        </View>

        {report.recommended_next_steps?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommended Next Steps</Text>
            {report.recommended_next_steps.map((step, index) => (
              <Text key={step} style={styles.stepItem}>
                {index + 1}. {step}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.disclaimer}>
            {report.disclaimer ||
              'Educational analysis only. Not a credit score calculation, credit counseling substitute, or legal advice. Does not guarantee score changes, deletions, or financing approval.'}
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
