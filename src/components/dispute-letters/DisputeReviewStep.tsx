'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { DisputeLettersStepStrip } from '@/components/dispute-letters/DisputeLettersStepStrip'
import { EmptyState } from '@/components/dispute-letters/EmptyState'
import { TradelineCard } from '@/components/dispute-letters/TradelineCard'
import {
  buildDisputePlan,
  fetchDisputeReport,
  patchDisputeTradelines,
} from '@/lib/dispute-letters/client-api'
import {
  PRIORITY_ORDER,
  sourceLabel,
  type BureauCode,
  type Tradeline,
} from '@/lib/dispute-letters/types'
import type { DisputeLetterStep } from '@/lib/dispute-letters/workflow'
import { disputeLettersStandaloneHref } from '@/lib/dispute-letters/workflow'

type FilterMode = 'all' | 'negative' | 'collections' | 'high' | BureauCode

function isNegative(t: Tradeline) {
  return t.repair_priority !== 'none' && t.repair_priority !== 'low'
}

export default function DisputeReviewStep({
  sessionId,
  embedded = false,
  onStepChange,
}: {
  sessionId: string
  embedded?: boolean
  onStepChange?: (step: DisputeLetterStep) => void
}) {
  const [reportMeta, setReportMeta] = useState<{ source: string; consumer: string } | null>(null)
  const [tradelines, setTradelines] = useState<Tradeline[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterMode>('all')

  useEffect(() => {
    if (!sessionId) return
    setReportMeta(null)
    fetchDisputeReport(sessionId)
      .then((data) => {
        setReportMeta({
          source: data.report.source,
          consumer: data.report.consumer.name,
        })
        const tls = data.report.tradelines.map((t) => ({
          ...t,
          dispute_bureaus: t.dispute_bureaus?.length ? t.dispute_bureaus : t.bureaus,
          dispute_reason: t.dispute_reason || t.suggested_dispute_reason || '',
          repair_priority: t.repair_priority || 'none',
        }))
        if (!tls.some((t) => t.selected)) {
          tls.forEach((t) => {
            if (t.repair_priority === 'high') t.selected = true
          })
        }
        setTradelines(tls)
      })
      .catch(() => setError('Failed to load report'))
  }, [sessionId])

  const filtered = useMemo(() => {
    const list = tradelines.filter((t) => {
      if (filter === 'negative') return isNegative(t)
      if (filter === 'collections') return t.is_collection
      if (filter === 'high') return t.repair_priority === 'high'
      if (filter === 'TUC' || filter === 'EXP' || filter === 'EQF') {
        return t.bureaus.includes(filter)
      }
      return true
    })
    return [...list].sort(
      (a, b) =>
        PRIORITY_ORDER[a.repair_priority || 'none'] - PRIORITY_ORDER[b.repair_priority || 'none']
    )
  }, [tradelines, filter])

  const recommended = filtered.filter((t) => t.repair_priority !== 'none')
  const optional = filtered.filter((t) => t.repair_priority === 'none')

  function update(id: string, patch: Partial<Tradeline>) {
    setTradelines((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  function toggleDisputeBureau(id: string, bureau: BureauCode, checked: boolean) {
    setTradelines((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const next = checked
          ? [...new Set([...t.dispute_bureaus, bureau])]
          : t.dispute_bureaus.filter((b) => b !== bureau)
        return { ...t, dispute_bureaus: next }
      })
    )
  }

  function selectHighPriority() {
    setTradelines((prev) =>
      prev.map((t) =>
        t.repair_priority === 'high'
          ? {
              ...t,
              selected: true,
              dispute_reason: t.dispute_reason || t.suggested_dispute_reason,
            }
          : t
      )
    )
  }

  function clearSelection() {
    setTradelines((prev) => prev.map((t) => ({ ...t, selected: false })))
  }

  async function continueToConfirm() {
    setLoading(true)
    setError('')
    try {
      await patchDisputeTradelines(sessionId, tradelines)
      const selections = tradelines
        .filter((t) => t.selected)
        .map((t) => ({
          id: t.id,
          selected: true,
          dispute_reason: t.dispute_reason.trim() || t.suggested_dispute_reason.trim(),
        }))
        .filter((s) => s.dispute_reason)
      const hasTargets = tradelines.some(
        (t) => t.selected && (t.dispute_bureaus.length > 0 || t.dispute_furnisher)
      )
      if (!selections.length || !hasTargets) {
        setError('Select at least one account with a dispute reason and letter target.')
        setLoading(false)
        return
      }
      await buildDisputePlan(sessionId, selections, {})
      if (onStepChange) onStepChange('confirm')
      else window.location.assign(disputeLettersStandaloneHref(sessionId, 'confirm'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to build plan')
    } finally {
      setLoading(false)
    }
  }

  if (!reportMeta) {
    return <p className="text-brand-dim">Loading disputes…</p>
  }

  function renderGroup(title: string, items: Tradeline[]) {
    if (!items.length) return null
    return (
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-brand-text">{title}</h3>
        {items.map((t) => (
          <TradelineCard
            key={t.id}
            tradeline={t}
            selected={t.selected}
            onSelect={(checked) => update(t.id, { selected: checked })}
            onChange={(patch) => update(t.id, patch)}
            onToggleBureau={(b, c) => toggleDisputeBureau(t.id, b, c)}
            showTargets
            showReason
          />
        ))}
      </section>
    )
  }

  return (
    <div className={`${embedded ? '' : 'max-w-4xl'} space-y-6`}>
      {!embedded && <DisputeLettersStepStrip sessionId={sessionId} />}

      <div className="rounded-xl border border-brand-border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-brand-text">Choose disputes</h2>
        <p className="mt-1 text-sm text-brand-dim">
          {reportMeta.consumer || 'Consumer'} · {sourceLabel(reportMeta.source)}
        </p>
      </div>

      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-brand-border bg-white/95 p-3 backdrop-blur shadow-sm">
        <select
          className="rounded-lg border border-brand-border px-3 py-2 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterMode)}
        >
          <option value="all">All accounts</option>
          <option value="high">High priority</option>
          <option value="negative">Negative</option>
          <option value="collections">Collections</option>
          <option value="TUC">TransUnion</option>
          <option value="EXP">Experian</option>
          <option value="EQF">Equifax</option>
        </select>
        <button
          type="button"
          className="rounded-lg border border-brand-border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          onClick={selectHighPriority}
        >
          Select high priority
        </button>
        <button
          type="button"
          className="rounded-lg border border-brand-border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          onClick={clearSelection}
        >
          Clear
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No matches" message="Try a different filter." />
      ) : (
        <div className="space-y-8">
          {renderGroup('Dispute recommended', recommended)}
          {renderGroup('Optional / positive accounts', optional)}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          disabled={loading}
          onClick={() => void continueToConfirm()}
        >
          Continue to letter plan
        </button>
        {embedded && onStepChange ? (
          <button
            type="button"
            className="rounded-lg border border-brand-border px-4 py-2 text-sm font-medium text-brand-text hover:bg-neutral-50"
            onClick={() => onStepChange('health')}
          >
            Back to health
          </button>
        ) : (
          <Link
            href={disputeLettersStandaloneHref(sessionId, 'health')}
            className="rounded-lg border border-brand-border px-4 py-2 text-sm font-medium text-brand-text hover:bg-neutral-50"
          >
            Back to health
          </Link>
        )}
      </div>
    </div>
  )
}
