'use client'

import { useEffect, useMemo, useState, type MutableRefObject } from 'react'
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
import {
  applyRecommendedSelection,
  isRecommendedDispute,
} from '@/lib/dispute-letters/dispute-selection'
import { isNegativeTradeline } from '@/lib/dispute-letters/bureau-coverage'
import { isInquiryTradeline, planSelectionsFromTradelines, resolvedDisputeReason } from '@/lib/dispute-letters/dispute-reasons'
import {
  ROUND_1_MAX_ITEMS_PER_BUREAU,
  enforceRound1BureauCaps,
  expandTradelineSelections,
} from '@/lib/dispute-letters/dispute-lifecycle'
import type { DisputeLetterStep } from '@/lib/dispute-letters/workflow'
import { disputeLettersStandaloneHref } from '@/lib/dispute-letters/workflow'

type FilterMode = 'all' | 'negative' | 'collections' | 'high' | BureauCode

export default function DisputeReviewStep({
  sessionId,
  embedded = false,
  onStepChange,
  persistRef,
}: {
  sessionId: string
  embedded?: boolean
  onStepChange?: (step: DisputeLetterStep) => void
  persistRef?: MutableRefObject<(() => Promise<void>) | null>
}) {
  const [reportMeta, setReportMeta] = useState<{ source: string; consumer: string } | null>(null)
  const [tradelines, setTradelines] = useState<Tradeline[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterMode>('all')

  useEffect(() => {
    if (!persistRef) return
    persistRef.current = async () => {
      if (!tradelines.length) return
      await patchDisputeTradelines(sessionId, tradelines)
    }
    return () => {
      persistRef.current = null
    }
  }, [persistRef, sessionId, tradelines])

  useEffect(() => {
    if (!sessionId) return
    setReportMeta(null)
    setError('')
    fetchDisputeReport(sessionId)
      .then((data) => {
        setReportMeta({
          source: data.report.source,
          consumer: data.report.consumer?.name || 'Consumer',
        })
        const tls = data.report.tradelines.map((t) => ({
          ...t,
          dispute_bureaus: t.dispute_bureaus?.length ? t.dispute_bureaus : t.bureaus || [],
          dispute_reason:
            t.dispute_reason ||
            t.suggested_dispute_reason ||
            (isInquiryTradeline(t) ? resolvedDisputeReason(t) : ''),
          repair_priority: t.repair_priority || 'none',
        }))
        if (!tls.some((t) => t.selected)) {
          setTradelines(applyRecommendedSelection(tls))
        } else {
          setTradelines(tls)
        }
      })
      .catch(() => setError('Failed to load report'))
  }, [sessionId])

  const filtered = useMemo(() => {
    const list = tradelines.filter((t) => {
      if (filter === 'negative') return isNegativeTradeline(t)
      if (filter === 'collections') return t.is_collection
      if (filter === 'high') return t.repair_priority === 'high'
      if (filter === 'TUC' || filter === 'EXP' || filter === 'EQF') {
        return (t.bureaus || []).includes(filter)
      }
      return true
    })
    return [...list].sort(
      (a, b) =>
        PRIORITY_ORDER[a.repair_priority || 'none'] - PRIORITY_ORDER[b.repair_priority || 'none']
    )
  }, [tradelines, filter])

  const round1Cap = useMemo(
    () => enforceRound1BureauCaps(expandTradelineSelections(tradelines)),
    [tradelines]
  )

  const recommended = filtered.filter((t) => isRecommendedDispute(t))
  const optional = filtered.filter((t) => !isRecommendedDispute(t))

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

  function selectRecommended() {
    setTradelines((prev) =>
      prev.map((t) =>
        isRecommendedDispute(t)
          ? {
              ...t,
              selected: true,
              dispute_reason: t.dispute_reason || resolvedDisputeReason(t),
            }
          : t
      )
    )
  }

  function selectUnauthorizedInquiries() {
    setTradelines((prev) =>
      prev.map((t) =>
        isInquiryTradeline(t)
          ? {
              ...t,
              selected: true,
              dispute_reason: t.dispute_reason || resolvedDisputeReason(t),
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
      if (!round1Cap.ok) {
        setError(round1Cap.message || 'Too many Round 1 items per bureau.')
        setLoading(false)
        return
      }
      await patchDisputeTradelines(sessionId, tradelines)
      const selections = planSelectionsFromTradelines(tradelines)
      const hasTargets = tradelines.some(
        (t) => t.selected && ((t.dispute_bureaus || []).length > 0 || t.dispute_furnisher)
      )
      if (!selections.length || !hasTargets) {
        setError('Select at least one account with a letter target.')
        setLoading(false)
        return
      }
      await buildDisputePlan(sessionId, selections, {}, tradelines)
      if (onStepChange) onStepChange('confirm')
      else window.location.assign(disputeLettersStandaloneHref(sessionId, 'confirm'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to build plan')
    } finally {
      setLoading(false)
    }
  }

  if (error && !reportMeta) {
    return <p className="text-sm text-red-600">{error}</p>
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
            onSelect={(checked) =>
              update(t.id, {
                selected: checked,
                dispute_reason: checked ? t.dispute_reason || resolvedDisputeReason(t) : t.dispute_reason,
              })
            }
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
      {!embedded && (
        <DisputeLettersStepStrip
          sessionId={sessionId}
          persistBeforeNavigate={async () => {
            await patchDisputeTradelines(sessionId, tradelines)
          }}
        />
      )}

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
          onClick={selectRecommended}
        >
          Select recommended
        </button>
        <button
          type="button"
          className="rounded-lg border border-brand-border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          onClick={selectUnauthorizedInquiries}
        >
          Select unauthorized inquiries
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

      {!round1Cap.ok && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Round 1 cap: max {ROUND_1_MAX_ITEMS_PER_BUREAU} items per bureau. {round1Cap.message}
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
            onClick={() => {
              void (async () => {
                try {
                  await patchDisputeTradelines(sessionId, tradelines)
                  onStepChange('health')
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Failed to save selections')
                }
              })()
            }}
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
