'use client'

import {
  FACTOR_LABELS,
  impactPercent,
  type CreditIntelligenceReport,
  type Recommendation,
} from '@/lib/dispute-letters/types'

function bandClass(band: string) {
  const b = band.toLowerCase()
  if (b.includes('exceptional') || b.includes('very_good') || b === 'strong') return 'text-emerald-700 bg-emerald-50'
  if (b.includes('good') || b === 'moderate') return 'text-sky-800 bg-sky-50'
  if (b.includes('fair') || b === 'mixed' || b === 'developing') return 'text-amber-800 bg-amber-50'
  if (b.includes('poor') || b === 'weak' || b === 'limited' || b === 'severe') return 'text-red-800 bg-red-50'
  return 'text-brand-dim bg-neutral-50'
}

function FactorCard({
  title,
  summary,
  band,
  strengths,
  weaknesses,
}: {
  title: string
  summary: string
  band: string
  strengths: string[]
  weaknesses: string[]
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-white p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-brand-text">{title}</h4>
        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${bandClass(band)}`}>
          {band.replace(/_/g, ' ')}
        </span>
      </div>
      <p className="text-sm text-brand-muted leading-relaxed">{summary}</p>
      {strengths.length > 0 && (
        <ul className="mt-2 space-y-1">
          {strengths.slice(0, 2).map((s) => (
            <li key={s} className="text-xs text-emerald-800">+ {s}</li>
          ))}
        </ul>
      )}
      {weaknesses.length > 0 && (
        <ul className="mt-2 space-y-1">
          {weaknesses.slice(0, 2).map((w) => (
            <li key={w} className="text-xs text-amber-900">− {w}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RecommendationRow({ rec }: { rec: Recommendation }) {
  return (
    <div className="border-b border-brand-border last:border-0 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-brand-text">{rec.title}</p>
        <p className="text-[11px] text-brand-dim">
          Impact {impactPercent(rec.estimated_impact)} · Confidence {impactPercent(rec.confidence)}
        </p>
      </div>
      <p className="mt-1 text-sm text-brand-muted">{rec.rationale}</p>
      {rec.suggested_actions.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-brand-dim space-y-0.5">
          {rec.suggested_actions.slice(0, 4).map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      {rec.legal_basis && (
        <p className="mt-1 text-[11px] text-brand-dim">Legal basis: {rec.legal_basis}</p>
      )}
    </div>
  )
}

export default function CreditIntelligenceDashboard({
  intelligence,
  sessionId,
  showDisputeCta = true,
  onOpenDisputeWorkflow,
  fundingBlockTitle = 'Funding readiness',
  fundingBlockSubtitle,
}: {
  intelligence: CreditIntelligenceReport
  sessionId?: string
  showDisputeCta?: boolean
  onOpenDisputeWorkflow?: () => void
  /** Override title when embedded in Credit & Funding (advisory vs staff scores). */
  fundingBlockTitle?: string
  fundingBlockSubtitle?: string
}) {
  const overall = intelligence.overall
  const funding = intelligence.funding_readiness
  const disputeInsights = (intelligence.account_dispute_insights || []).filter(
    (i) => i.dispute_recommended
  )

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-brand-border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-brand-text">Credit Profile Analysis</h3>
            <p className="mt-1 text-sm text-brand-dim">
              {intelligence.consumer_name || 'Client'}
              {intelligence.report_date ? ` · Report ${intelligence.report_date}` : ''}
            </p>
          </div>
          <span className={`text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full ${bandClass(overall.band)}`}>
            {overall.band.replace(/_/g, ' ')}
            {overall.average_score != null ? ` · ~${overall.average_score}` : ''}
          </span>
        </div>
        <p className="mt-3 text-sm text-brand-muted leading-relaxed">{overall.narrative}</p>
        <p className="mt-2 text-[11px] text-brand-dim">{intelligence.disclaimer}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-brand-border bg-white p-4">
          <h4 className="text-sm font-bold text-brand-text mb-2">Strengths</h4>
          {overall.strengths.length === 0 ? (
            <p className="text-sm text-brand-dim">No clear strengths extracted yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm text-brand-muted">
              {overall.strengths.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-brand-border bg-white p-4">
          <h4 className="text-sm font-bold text-brand-text mb-2">Weaknesses & risks</h4>
          <ul className="space-y-1.5 text-sm text-brand-muted">
            {[...overall.weaknesses, ...overall.risk_factors].slice(0, 10).map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <h4 className="text-sm font-bold text-sky-950">{fundingBlockTitle}</h4>
            {fundingBlockSubtitle ? (
              <p className="mt-0.5 text-xs text-sky-800">{fundingBlockSubtitle}</p>
            ) : null}
          </div>
          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${bandClass(funding.level)}`}>
            {funding.level} · {funding.score_0_to_100}/100
          </span>
        </div>
        <p className="text-sm text-sky-900 mb-3">{funding.summary}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-sky-800 mb-1">Blockers</p>
            <ul className="space-y-1 text-sky-950">
              {(funding.blockers.length ? funding.blockers : ['None flagged from available data.']).map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-sky-800 mb-1">Supportive signals</p>
            <ul className="space-y-1 text-sky-950">
              {(funding.supportive_signals.length
                ? funding.supportive_signals
                : ['Limited supportive signals in current extract.']
              ).map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
          </div>
        </div>
        {funding.practical_steps.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase text-sky-800 mb-1">Practical next steps</p>
            <ul className="space-y-1 text-sm text-sky-950">
              {funding.practical_steps.slice(0, 6).map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-bold text-brand-text mb-3">Factor analysis</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {intelligence.factors.map((f) => (
            <FactorCard
              key={f.factor}
              title={FACTOR_LABELS[f.factor] || f.factor}
              summary={f.summary}
              band={f.score_band}
              strengths={f.strengths}
              weaknesses={f.weaknesses}
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-brand-border bg-white p-4">
        <h4 className="text-sm font-bold text-brand-text mb-1">Prioritized recommendations</h4>
        <p className="text-xs text-brand-dim mb-2">Ranked by estimated impact × confidence</p>
        {intelligence.recommendations.length === 0 ? (
          <p className="text-sm text-brand-dim">No recommendations generated.</p>
        ) : (
          intelligence.recommendations.slice(0, 10).map((r) => (
            <RecommendationRow key={r.id} rec={r} />
          ))
        )}
      </div>

      {disputeInsights.length > 0 && (
        <div className="rounded-xl border border-brand-border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-sm font-bold text-brand-text">Account-level dispute recommendations</h4>
              <p className="text-xs text-brand-dim">{disputeInsights.length} account(s) flagged for review</p>
            </div>
            {showDisputeCta && sessionId && onOpenDisputeWorkflow && (
              <button
                type="button"
                onClick={onOpenDisputeWorkflow}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent text-white hover:opacity-90"
              >
                Prepare dispute letters
              </button>
            )}
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {disputeInsights.slice(0, 20).map((i) => (
              <div key={i.tradeline_id} className="border-b border-brand-border pb-2 last:border-0">
                <p className="text-sm font-semibold text-brand-text">
                  {i.creditor}{' '}
                  <span className="text-xs font-normal text-brand-dim">({i.category})</span>
                </p>
                <p className="text-xs text-brand-muted mt-0.5">{i.rationale}</p>
                {i.legal_citations && i.legal_citations.length > 0 && (
                  <p className="text-[11px] text-brand-dim mt-1">{i.legal_citations.join(' · ')}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {intelligence.recommended_next_steps.length > 0 && (
        <div className="rounded-xl border border-brand-border bg-neutral-50 p-4">
          <h4 className="text-sm font-bold text-brand-text mb-2">Recommended next steps</h4>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-brand-muted">
            {intelligence.recommended_next_steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
