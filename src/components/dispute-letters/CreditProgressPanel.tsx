'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatProgressDate } from '@/lib/dispute-letters/credit-progress'
import type {
  BureauCode,
  CreditProgressDelta,
  CreditProgressDirection,
  CreditProgressReport,
  CreditProgressSnapshot,
  TradelineProgressDiff,
} from '@/lib/dispute-letters/types'
import { BUREAU_LABELS } from '@/lib/dispute-letters/types'

function scoreFromSnap(snap: CreditProgressSnapshot | null | undefined, bureau: BureauCode): number | null {
  if (!snap) return null
  if (bureau === 'EXP') return snap.bureauScores.exp
  if (bureau === 'TUC') return snap.bureauScores.tuc
  return snap.bureauScores.eqf
}

function scoreDeltaDirection(from: number | null, to: number | null): CreditProgressDirection {
  if (from == null || to == null) return 'unknown'
  if (from === to) return 'unchanged'
  return to > from ? 'improved' : 'worsened'
}

function ScoreHero({
  bureauName,
  fromScore,
  toScore,
  fromLabel,
  toLabel,
}: {
  bureauName: string
  fromScore: number | null
  toScore: number | null
  fromLabel: string
  toLabel: string
}) {
  const direction = scoreDeltaDirection(fromScore, toScore)
  const delta =
    fromScore != null && toScore != null ? toScore - fromScore : null
  const deltaText =
    delta == null ? null : delta > 0 ? `+${delta}` : delta === 0 ? '0' : String(delta)

  return (
    <div className="rounded-xl border border-brand-border bg-neutral-50 px-4 py-6 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-dim">
        {bureauName} score
      </p>
      {fromScore != null && toScore != null && fromScore !== toScore ? (
        <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-brand-muted">
              {fromLabel}
            </p>
            <p className="font-serif text-4xl font-extrabold tabular-nums leading-none tracking-tight text-brand-dim sm:text-5xl">
              {fromScore}
            </p>
          </div>
          <span className="pb-1 text-2xl font-light text-brand-muted sm:text-3xl" aria-hidden>
            →
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-brand-muted">
              {toLabel}
            </p>
            <p
              className={`font-serif text-5xl font-extrabold tabular-nums leading-none tracking-tight sm:text-6xl ${
                direction === 'improved'
                  ? 'text-emerald-700'
                  : direction === 'worsened'
                    ? 'text-red-700'
                    : 'text-brand-text'
              }`}
            >
              {toScore}
            </p>
          </div>
          {deltaText != null && (
            <div className="pb-1 sm:ml-2">
              <span
                className={`inline-block rounded-md px-2.5 py-1 text-sm font-bold tabular-nums ${
                  direction === 'improved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : direction === 'worsened'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-neutral-200 text-brand-dim'
                }`}
              >
                {deltaText} pts
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-brand-muted">
            {toScore != null ? toLabel : fromLabel}
          </p>
          <p className="font-serif text-5xl font-extrabold tabular-nums leading-none tracking-tight text-brand-text sm:text-6xl">
            {toScore ?? fromScore ?? '—'}
          </p>
        </div>
      )}
    </div>
  )
}

function CompactMetrics({ deltas }: { deltas: CreditProgressDelta[] }) {
  const secondary = deltas.filter((d) => d.field !== 'bureau_score')
  if (secondary.length === 0) return null
  return (
    <div className="grid grid-cols-3 gap-2">
      {secondary.map((d) => (
        <div
          key={d.field}
          className="rounded-lg border border-brand-border/80 bg-white px-2.5 py-2 text-center"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-dim leading-tight">
            {d.label}
          </p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-brand-text">
            {d.from ?? '—'} → {d.to ?? '—'}
          </p>
        </div>
      ))}
    </div>
  )
}

function FieldChangeLine({
  label,
  from,
  to,
  direction,
}: {
  label: string
  from: string
  to: string
  direction: 'improved' | 'worsened' | 'neutral'
}) {
  const toClass =
    direction === 'improved'
      ? 'text-emerald-800 font-semibold'
      : direction === 'worsened'
        ? 'text-red-800 font-semibold'
        : 'text-brand-text font-semibold'

  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-0.5 text-xs sm:grid-cols-[6.5rem_minmax(0,1fr)_auto_minmax(0,1.2fr)] sm:items-baseline">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-dim pt-0.5">
        {label}
      </span>
      <span className="text-brand-muted line-through decoration-brand-border/80 truncate" title={from}>
        {from}
      </span>
      <span className="hidden text-brand-muted sm:inline" aria-hidden>
        →
      </span>
      <span className={`${toClass} truncate`} title={to}>
        {to}
      </span>
    </div>
  )
}

function AccountChangeSection({
  diff,
}: {
  diff: TradelineProgressDiff | null | undefined
}) {
  if (!diff) return null

  const hasAny =
    diff.removed.length > 0 || diff.added.length > 0 || diff.changed.length > 0

  if (!hasAny) {
    return (
      <p className="text-sm text-brand-dim">
        {diff.matchConfidence === 'low'
          ? 'Could not match accounts reliably — score above still applies.'
          : 'No account-level changes detected.'}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-dim">
        Account changes
      </h4>

      {diff.changed.length > 0 && (
        <ul className="max-h-72 overflow-y-auto divide-y divide-brand-border/70 rounded-md border border-brand-border">
          {diff.changed.map((item, i) => (
            <li
              key={`ch-${item.creditor}-${item.accountMask}-${i}`}
              className="px-3 py-2.5"
            >
              <p className="mb-1.5 text-sm font-semibold text-brand-text">
                {item.creditor}
                {item.accountMask !== '—' ? (
                  <span className="ml-1.5 text-xs font-normal text-brand-dim">
                    {item.accountMask}
                  </span>
                ) : null}
              </p>
              <div className="space-y-1">
                {item.fields.map((f) => (
                  <FieldChangeLine
                    key={f.field}
                    label={f.label}
                    from={f.from}
                    to={f.to}
                    direction={f.direction}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(diff.removed.length > 0 || diff.added.length > 0) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {diff.removed.length > 0 && (
            <div className="max-h-36 overflow-y-auto rounded-md border border-emerald-200/80 bg-emerald-50/30 px-2.5 py-2 text-xs">
              <p className="mb-1 font-semibold text-emerald-800">
                Removed ({diff.removed.length})
              </p>
              <ul className="space-y-0.5 text-brand-text">
                {diff.removed.map((item, i) => (
                  <li key={`rm-${item.creditor}-${item.accountMask}-${i}`}>
                    {item.creditor}
                    {item.accountMask !== '—' ? ` ${item.accountMask}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {diff.added.length > 0 && (
            <div className="max-h-36 overflow-y-auto rounded-md border border-amber-200/80 bg-amber-50/30 px-2.5 py-2 text-xs">
              <p className="mb-1 font-semibold text-amber-900">New ({diff.added.length})</p>
              <ul className="space-y-0.5 text-brand-text">
                {diff.added.map((item, i) => (
                  <li key={`add-${item.creditor}-${item.accountMask}-${i}`}>
                    {item.creditor}
                    {item.accountMask !== '—' ? ` ${item.accountMask}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
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

  if (!progress.current || !bureau) {
    return (
      <div className="rounded-xl border border-dashed border-brand-border bg-neutral-50 px-4 py-5">
        <p className="text-sm text-brand-dim">No {bureauName} report selected.</p>
      </div>
    )
  }

  const baseline = progress.baseline || progress.current
  const canPrevious =
    !!progress.previous &&
    progress.previous.sessionId !== baseline.sessionId &&
    (progress.vsPrevious?.length || 0) > 0

  const compareSnap =
    compareMode === 'previous' && canPrevious && progress.previous
      ? progress.previous
      : baseline

  const fromScore = scoreFromSnap(compareSnap, bureau)
  const toScore = scoreFromSnap(progress.current, bureau)

  const isSameReport = compareSnap.sessionId === progress.current.sessionId
  const activeDeltas =
    compareMode === 'previous' && canPrevious ? progress.vsPrevious : progress.vsBaseline
  const accountDiff =
    compareMode === 'previous' && canPrevious
      ? progress.accountChangesVsPrevious
      : progress.accountChangesVsBaseline

  const fromLabel = isSameReport
    ? 'Current'
    : compareMode === 'previous'
      ? 'Previous'
      : 'First report'
  const toLabel = isSameReport ? 'Latest' : 'Updated'

  return (
    <div className="rounded-xl border border-brand-border bg-white px-4 py-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-brand-text">{bureauName} progress</h3>
          <p className="mt-0.5 text-xs text-brand-muted">
            {formatProgressDate(compareSnap.reportDate)}
            {!isSameReport && progress.current.reportDate
              ? ` → ${formatProgressDate(progress.current.reportDate)}`
              : ''}
          </p>
        </div>
        {canPrevious && (
          <div className="flex rounded-lg border border-brand-border overflow-hidden">
            <button
              type="button"
              onClick={() => setCompareMode('baseline')}
              className={`px-2.5 py-1 text-[11px] font-semibold ${
                compareMode === 'baseline'
                  ? 'bg-brand-text text-white'
                  : 'bg-white text-brand-dim hover:bg-neutral-50'
              }`}
            >
              vs first
            </button>
            <button
              type="button"
              onClick={() => setCompareMode('previous')}
              className={`px-2.5 py-1 text-[11px] font-semibold border-l border-brand-border ${
                compareMode === 'previous'
                  ? 'bg-brand-text text-white'
                  : 'bg-white text-brand-dim hover:bg-neutral-50'
              }`}
            >
              vs previous
            </button>
          </div>
        )}
      </div>

      <ScoreHero
        bureauName={bureauName}
        fromScore={isSameReport ? toScore : fromScore}
        toScore={toScore}
        fromLabel={isSameReport ? 'Report score' : fromLabel}
        toLabel={isSameReport ? 'Report score' : toLabel}
      />

      {!isSameReport && activeDeltas.length > 0 && <CompactMetrics deltas={activeDeltas} />}

      {!isSameReport && <AccountChangeSection diff={accountDiff} />}

      {isSameReport && progress.readyCount < 2 && (
        <p className="text-sm text-brand-dim">
          Upload another {bureauName} report to compare score movement and account changes.
        </p>
      )}
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
          {available.map((bureau) => {
            const snap = progressByBureau[bureau]?.current
            const score = snap ? scoreFromSnap(snap, bureau) : null
            return (
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
                {score != null && (
                  <span className="ml-1.5 tabular-nums opacity-80">{score}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      {progress && <BureauProgressBody progress={progress} />}
    </div>
  )
}
