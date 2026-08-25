'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatProgressDate } from '@/lib/dispute-letters/credit-progress'
import type {
  BureauCode,
  CreditProgressDelta,
  CreditProgressDirection,
  CreditProgressReport,
  FieldChangeDirection,
  TradelineProgressDiff,
} from '@/lib/dispute-letters/types'
import { BUREAU_LABELS } from '@/lib/dispute-letters/types'

function directionClass(direction: CreditProgressDirection | FieldChangeDirection): string {
  if (direction === 'improved') return 'text-emerald-700'
  if (direction === 'worsened') return 'text-red-700'
  if (direction === 'unchanged' || direction === 'neutral') return 'text-brand-dim'
  return 'text-brand-muted'
}

function directionLabel(direction: CreditProgressDirection | FieldChangeDirection): string {
  if (direction === 'improved') return 'Improved'
  if (direction === 'worsened') return 'Worsened'
  if (direction === 'unchanged') return 'Unchanged'
  if (direction === 'neutral') return 'Changed'
  return 'Unknown'
}

function formatValue(value: string | number | null): string {
  if (value == null || value === '') return '—'
  return String(value)
}

function DeltaRows({
  deltas,
  changedOnly = false,
}: {
  deltas: CreditProgressDelta[]
  changedOnly?: boolean
}) {
  const rows = changedOnly
    ? deltas.filter((d) => d.direction === 'improved' || d.direction === 'worsened')
    : deltas
  if (rows.length === 0) {
    return <p className="text-sm text-brand-dim">No measurable changes.</p>
  }
  return (
    <ul className="divide-y divide-brand-border/70">
      {rows.map((d) => (
        <li key={d.field} className="flex items-baseline justify-between gap-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="font-medium text-brand-text">{d.label}</p>
            <p className="text-xs text-brand-dim">
              {formatValue(d.from)} → {formatValue(d.to)}
            </p>
          </div>
          <span
            className={`shrink-0 text-xs font-semibold uppercase tracking-wide ${directionClass(d.direction)}`}
          >
            {directionLabel(d.direction)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function AccountChangeSection({
  title,
  diff,
  compareLabel,
}: {
  title: string
  diff: TradelineProgressDiff | null | undefined
  compareLabel: string
}) {
  if (!diff) return null

  const hasAny =
    diff.removed.length > 0 || diff.added.length > 0 || diff.changed.length > 0

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-dim">{title}</h4>
        <p className="mt-0.5 text-xs text-brand-muted">{compareLabel}</p>
      </div>

      {!hasAny && (
        <p className="text-sm text-brand-dim">
          {diff.matchConfidence === 'low'
            ? 'Could not match accounts reliably — scores and counts above still apply.'
            : 'No account-level changes detected.'}
        </p>
      )}

      {diff.removed.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-emerald-800 mb-1">Removed from report</p>
          <ul className="space-y-1.5">
            {diff.removed.map((item, i) => (
              <li
                key={`rm-${item.creditor}-${item.accountMask}-${i}`}
                className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-brand-text">
                    {item.creditor} {item.accountMask}
                  </span>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-800">
                    Removed
                  </span>
                </div>
                <p className="text-xs text-brand-dim mt-0.5">
                  {[item.status, item.balance, item.category].filter(Boolean).join(' · ') || '—'}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.added.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-800 mb-1">New on report</p>
          <ul className="space-y-1.5">
            {diff.added.map((item, i) => (
              <li
                key={`add-${item.creditor}-${item.accountMask}-${i}`}
                className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-brand-text">
                    {item.creditor} {item.accountMask}
                  </span>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-900">
                    New
                  </span>
                </div>
                <p className="text-xs text-brand-dim mt-0.5">
                  {[item.status, item.balance, item.category].filter(Boolean).join(' · ') || '—'}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.changed.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-brand-dim mb-1">Changed accounts</p>
          <ul className="divide-y divide-brand-border/70 rounded-lg border border-brand-border">
            {diff.changed.map((item, i) => (
              <li key={`ch-${item.creditor}-${item.accountMask}-${i}`} className="px-3 py-2.5">
                <p className="text-sm font-medium text-brand-text">
                  {item.creditor} {item.accountMask}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {item.fields.map((f) => (
                    <li
                      key={f.field}
                      className="flex flex-wrap items-baseline justify-between gap-2 text-xs"
                    >
                      <span className="text-brand-dim">
                        {f.label}: {f.from} → {f.to}
                      </span>
                      <span className={`font-semibold uppercase ${directionClass(f.direction)}`}>
                        {directionLabel(f.direction)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-brand-muted leading-relaxed">
        “Removed” means the account is no longer on this bureau report — not a guaranteed deletion from
        the credit file. Matching depends on parsed account numbers.
      </p>
    </div>
  )
}

function BureauProgressBody({ progress }: { progress: CreditProgressReport }) {
  const bureau = progress.bureau
  const bureauName = bureau ? BUREAU_LABELS[bureau] : 'bureau'
  const [compareMode, setCompareMode] = useState<'baseline' | 'previous'>('baseline')

  useEffect(() => {
    setCompareMode('baseline')
  }, [progress.bureau, progress.current?.sessionId])

  if (progress.readyCount < 2 || !progress.current || !progress.baseline) {
    return (
      <div className="rounded-xl border border-dashed border-brand-border bg-neutral-50 px-4 py-5">
        <h3 className="text-sm font-bold text-brand-text">Progress since first {bureauName} report</h3>
        <p className="mt-1 text-sm text-brand-dim">
          Upload another {bureauName} report to track score and negative-item changes.
        </p>
      </div>
    )
  }

  if (progress.current.sessionId === progress.baseline.sessionId) {
    return (
      <div className="rounded-xl border border-dashed border-brand-border bg-neutral-50 px-4 py-5">
        <h3 className="text-sm font-bold text-brand-text">Progress since first {bureauName} report</h3>
        <p className="mt-1 text-sm text-brand-dim">
          This is the baseline {bureauName} report from{' '}
          {formatProgressDate(progress.baseline.reportDate)}. Select a later {bureauName} analysis to
          see what changed.
        </p>
      </div>
    )
  }

  const canPrevious =
    !!progress.previous &&
    progress.previous.sessionId !== progress.baseline.sessionId &&
    progress.vsPrevious.length > 0

  const activeDeltas = compareMode === 'previous' && canPrevious ? progress.vsPrevious : progress.vsBaseline
  const accountDiff =
    compareMode === 'previous' && canPrevious
      ? progress.accountChangesVsPrevious
      : progress.accountChangesVsBaseline

  const compareLabel =
    compareMode === 'previous' && progress.previous
      ? `vs previous upload (${formatProgressDate(progress.previous.reportDate)})`
      : `vs first ${bureauName} report (${formatProgressDate(progress.baseline.reportDate)})`

  return (
    <div className="rounded-xl border border-brand-border bg-white px-4 py-5 space-y-5">
      <div>
        <h3 className="text-sm font-bold text-brand-text">Progress since first {bureauName} report</h3>
        <p className="mt-1 text-sm text-brand-muted">
          Compared to first {bureauName} report ({formatProgressDate(progress.baseline.reportDate)})
          {progress.current.reportDate
            ? ` → selected ${formatProgressDate(progress.current.reportDate)}`
            : ''}
          .
        </p>
      </div>

      {canPrevious && (
        <div className="flex rounded-lg border border-brand-border overflow-hidden w-fit">
          <button
            type="button"
            onClick={() => setCompareMode('baseline')}
            className={`px-3 py-1.5 text-xs font-semibold ${
              compareMode === 'baseline'
                ? 'bg-brand-text text-white'
                : 'bg-white text-brand-dim hover:bg-neutral-50'
            }`}
          >
            vs first {bureauName}
          </button>
          <button
            type="button"
            onClick={() => setCompareMode('previous')}
            className={`px-3 py-1.5 text-xs font-semibold border-l border-brand-border ${
              compareMode === 'previous'
                ? 'bg-brand-text text-white'
                : 'bg-white text-brand-dim hover:bg-neutral-50'
            }`}
          >
            vs previous upload
          </button>
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-dim mb-1">
          Key metrics · {compareLabel}
        </h4>
        <DeltaRows deltas={activeDeltas} />
      </div>

      <AccountChangeSection
        title="Account changes"
        diff={accountDiff}
        compareLabel={compareLabel}
      />
    </div>
  )
}

export default function CreditProgressPanel({
  progressByBureau,
}: {
  progressByBureau: Partial<Record<BureauCode, CreditProgressReport>>
}) {
  const available = useMemo(
    () => (['EXP', 'TUC', 'EQF'] as BureauCode[]).filter((b) => progressByBureau[b]),
    [progressByBureau]
  )

  const [activeBureau, setActiveBureau] = useState<BureauCode | null>(null)

  useEffect(() => {
    if (available.length === 0) {
      setActiveBureau(null)
      return
    }
    if (!activeBureau || !available.includes(activeBureau)) {
      setActiveBureau(available[0])
    }
  }, [available, activeBureau])

  if (available.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-brand-border bg-neutral-50 px-4 py-5">
        <h3 className="text-sm font-bold text-brand-text">Bureau progress</h3>
        <p className="mt-1 text-sm text-brand-dim">
          Upload a credit report to start tracking Experian, TransUnion, and Equifax separately.
        </p>
      </div>
    )
  }

  const progress = activeBureau ? progressByBureau[activeBureau] : null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-brand-dim uppercase">Progress by bureau</span>
        <div className="flex rounded-lg border border-brand-border overflow-hidden">
          {available.map((bureau) => (
            <button
              key={bureau}
              type="button"
              onClick={() => setActiveBureau(bureau)}
              className={`px-3 py-1.5 text-xs font-semibold border-l border-brand-border first:border-l-0 ${
                activeBureau === bureau
                  ? 'bg-brand-text text-white'
                  : 'bg-white text-brand-dim hover:bg-neutral-50'
              }`}
            >
              {BUREAU_LABELS[bureau]}
              <span className="ml-1 opacity-70">({progressByBureau[bureau]?.readyCount || 0})</span>
            </button>
          ))}
        </div>
      </div>
      {progress && <BureauProgressBody progress={progress} />}
    </div>
  )
}
