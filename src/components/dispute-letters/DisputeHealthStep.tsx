'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import CreditIntelligenceDashboard from '@/components/dispute-letters/CreditIntelligenceDashboard'
import { DisputeLettersStepStrip } from '@/components/dispute-letters/DisputeLettersStepStrip'
import { EmptyState } from '@/components/dispute-letters/EmptyState'
import { ScoreCard } from '@/components/dispute-letters/ScoreCard'
import { StatCard } from '@/components/dispute-letters/StatCard'
import { TradelineCard } from '@/components/dispute-letters/TradelineCard'
import { fetchDisputeHealth, patchDisputeTradelines } from '@/lib/dispute-letters/client-api'
import { sourceLabel, type Tradeline } from '@/lib/dispute-letters/types'
import type { DisputeLetterStep } from '@/lib/dispute-letters/workflow'
import { disputeLettersStandaloneHref } from '@/lib/dispute-letters/workflow'

export default function DisputeHealthStep({
  sessionId,
  embedded = false,
  onStepChange,
}: {
  sessionId: string
  embedded?: boolean
  onStepChange?: (step: DisputeLetterStep) => void
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchDisputeHealth>> | null>(null)
  const [tradelines, setTradelines] = useState<Tradeline[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    setData(null)
    fetchDisputeHealth(sessionId)
      .then((health) => {
        setData(health)
        setTradelines(
          health.tradelines_by_priority.map((t) => ({
            ...t,
            selected: t.selected || t.repair_priority === 'high',
            dispute_reason: t.dispute_reason || t.suggested_dispute_reason || '',
            dispute_bureaus: t.dispute_bureaus?.length ? t.dispute_bureaus : t.bureaus,
          }))
        )
      })
      .catch(() => setError('Failed to load credit health summary'))
  }, [sessionId])

  function toggleSelect(id: string, checked: boolean) {
    setTradelines((prev) => prev.map((t) => (t.id === id ? { ...t, selected: checked } : t)))
  }

  async function continueToDisputes() {
    setSaving(true)
    try {
      await patchDisputeTradelines(sessionId, tradelines)
      if (onStepChange) onStepChange('review')
      else window.location.assign(disputeLettersStandaloneHref(sessionId, 'review'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save selections')
    } finally {
      setSaving(false)
    }
  }

  if (!data) {
    return <p className="text-brand-dim">Loading health summary…</p>
  }

  const { credit_health: h, consumer_name, report_date, credit_intelligence: intel } = data
  const selectedCount = tradelines.filter((t) => t.selected).length

  return (
    <div className={`${embedded ? '' : 'max-w-4xl'} space-y-6`}>
      {!embedded && <DisputeLettersStepStrip sessionId={sessionId} />}

      {!embedded && (
        <div className="rounded-xl border border-brand-border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-brand-text">Credit Intelligence Snapshot</h2>
          <p className="mt-1 text-sm text-brand-dim">
            {consumer_name || 'Consumer'}
            {report_date ? ` · Report date ${report_date}` : ''} · {sourceLabel(data.source)}
          </p>
        </div>
      )}

      {embedded && (
        <div>
          <h2 className="text-lg font-semibold text-brand-text">Priority dispute queue</h2>
          <p className="mt-1 text-sm text-brand-dim">
            {consumer_name || 'Consumer'}
            {report_date ? ` · Report date ${report_date}` : ''} · Select accounts to dispute
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <ScoreCard bureau="TransUnion" code="TUC" score={h.scores.tuc} />
        <ScoreCard bureau="Experian" code="EXP" score={h.scores.exp} />
        <ScoreCard bureau="Equifax" code="EQF" score={h.scores.eqf} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total accounts" value={h.total_accounts} />
        <StatCard label="Negative items" value={h.negative_count} />
        <StatCard label="Collections" value={h.collection_count} />
        <StatCard label="High priority" value={h.high_priority_count} hint="Dispute first" />
      </div>

      {!embedded && intel && (
        <CreditIntelligenceDashboard
          intelligence={intel}
          sessionId={sessionId}
          showDisputeCta={false}
        />
      )}

      {!intel && (h.repair_summary || h.recommended_actions.length > 0) && (
        <div className="rounded-xl border border-brand-border bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-brand-text">Repair plan</h3>
          {h.repair_summary && <p className="mt-2 text-sm text-brand-text">{h.repair_summary}</p>}
          {h.recommended_actions.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-brand-dim">
              {h.recommended_actions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-brand-text">
            {embedded ? 'Accounts' : 'Priority dispute queue'}
          </h3>
          <p className="text-sm text-brand-dim">{selectedCount} selected for dispute</p>
        </div>

        {tradelines.length === 0 ? (
          <EmptyState
            title="No accounts found"
            message="Try uploading a different report format or check the file quality."
          />
        ) : (
          <div className="space-y-3">
            {tradelines.map((t) => (
              <TradelineCard
                key={t.id}
                tradeline={t}
                selected={t.selected}
                onSelect={(checked) => toggleSelect(t.id, checked)}
                compact
              />
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          disabled={saving}
          onClick={() => void continueToDisputes()}
        >
          Continue to disputes ({selectedCount})
        </button>
        {!embedded && (
          <Link
            href="/admin/credit-funding"
            className="rounded-lg border border-brand-border px-4 py-2 text-sm font-medium text-brand-text hover:bg-neutral-50"
          >
            Back to Credit Intelligence
          </Link>
        )}
      </div>
    </div>
  )
}
