'use client'

import { formatProgressDate } from '@/lib/dispute-letters/credit-progress'
import type {
  CreditProgressDelta,
  CreditProgressDirection,
  CreditProgressReport,
} from '@/lib/dispute-letters/types'

function directionClass(direction: CreditProgressDirection): string {
  if (direction === 'improved') return 'text-emerald-700'
  if (direction === 'worsened') return 'text-red-700'
  if (direction === 'unchanged') return 'text-brand-dim'
  return 'text-brand-muted'
}

function directionLabel(direction: CreditProgressDirection): string {
  if (direction === 'improved') return 'Improved'
  if (direction === 'worsened') return 'Worsened'
  if (direction === 'unchanged') return 'Unchanged'
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
          <span className={`shrink-0 text-xs font-semibold uppercase tracking-wide ${directionClass(d.direction)}`}>
            {directionLabel(d.direction)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function splitCoreAndFactors(deltas: CreditProgressDelta[]) {
  const core = deltas.filter((d) => !d.field.startsWith('factor:'))
  const factors = deltas.filter((d) => d.field.startsWith('factor:'))
  return { core, factors }
}

export default function CreditProgressPanel({ progress }: { progress: CreditProgressReport }) {
  if (progress.readyCount < 2 || !progress.current || !progress.baseline) {
    return (
      <div className="rounded-xl border border-dashed border-brand-border bg-neutral-50 px-4 py-5">
        <h3 className="text-sm font-bold text-brand-text">Progress since first report</h3>
        <p className="mt-1 text-sm text-brand-dim">
          Upload a later report to track progress from this baseline.
        </p>
      </div>
    )
  }

  if (progress.current.sessionId === progress.baseline.sessionId) {
    return (
      <div className="rounded-xl border border-dashed border-brand-border bg-neutral-50 px-4 py-5">
        <h3 className="text-sm font-bold text-brand-text">Progress since first report</h3>
        <p className="mt-1 text-sm text-brand-dim">
          This is the baseline report from {formatProgressDate(progress.baseline.reportDate)}. Select a
          later analysis to see what changed.
        </p>
      </div>
    )
  }

  const vsBaseline = splitCoreAndFactors(progress.vsBaseline)
  const vsPrevious = splitCoreAndFactors(progress.vsPrevious)
  const showPrevious =
    !!progress.previous &&
    progress.previous.sessionId !== progress.baseline.sessionId &&
    progress.vsPrevious.length > 0

  return (
    <div className="rounded-xl border border-brand-border bg-white px-4 py-5 space-y-5">
      <div>
        <h3 className="text-sm font-bold text-brand-text">Progress since first report</h3>
        <p className="mt-1 text-sm text-brand-muted">
          Compared to first report ({formatProgressDate(progress.baseline.reportDate)})
          {progress.current.reportDate
            ? ` → selected ${formatProgressDate(progress.current.reportDate)}`
            : ''}
          .
        </p>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-dim mb-1">Key metrics</h4>
        <DeltaRows deltas={vsBaseline.core} />
      </div>

      {vsBaseline.factors.some((d) => d.direction === 'improved' || d.direction === 'worsened') && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-dim mb-1">
            Factor band changes
          </h4>
          <DeltaRows deltas={vsBaseline.factors} changedOnly />
        </div>
      )}

      {showPrevious && progress.previous && (
        <div className="border-t border-brand-border pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-dim mb-1">
            vs previous upload ({formatProgressDate(progress.previous.reportDate)})
          </h4>
          <DeltaRows
            deltas={[
              ...vsPrevious.core.filter(
                (d) => d.direction === 'improved' || d.direction === 'worsened'
              ),
              ...vsPrevious.factors.filter(
                (d) => d.direction === 'improved' || d.direction === 'worsened'
              ),
            ]}
          />
        </div>
      )}
    </div>
  )
}
