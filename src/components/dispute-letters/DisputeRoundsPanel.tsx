'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  itemStatusLabel,
  roundStatusLabel,
  type DisputeItemRow,
  type DisputeItemStatus,
  type DisputeLifecycleSnapshot,
  type DisputeRoundRow,
  type DisputeRoundStatus,
} from '@/lib/dispute-letters/dispute-lifecycle'
import { BUREAU_LABELS } from '@/lib/dispute-letters/types'

const ITEM_OUTCOMES: DisputeItemStatus[] = [
  'deleted',
  'verified',
  'updated',
  'no_response',
  'frivolous',
  'withdrawn',
  'pending',
  'disputed',
]

export default function DisputeRoundsPanel({ applicationId }: { applicationId: string }) {
  const [snapshot, setSnapshot] = useState<DisputeLifecycleSnapshot | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch(
        `/api/admin/dispute-letters/lifecycle?applicationUuid=${encodeURIComponent(applicationId)}`
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to load dispute rounds')
      }
      setSnapshot(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dispute rounds')
      setSnapshot(null)
    }
  }, [applicationId])

  useEffect(() => {
    void load()
  }, [load])

  async function patch(body: Record<string, unknown>) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/dispute-letters/lifecycle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Update failed')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  if (!snapshot) {
    return (
      <div className="rounded-xl border border-brand-border bg-white p-4">
        <p className="text-sm text-brand-dim">{error || 'Loading dispute rounds…'}</p>
      </div>
    )
  }

  if (!snapshot.case) {
    return (
      <div className="rounded-xl border border-dashed border-brand-border bg-neutral-50 p-4">
        <h3 className="text-sm font-bold text-brand-text">Dispute rounds</h3>
        <p className="mt-1 text-sm text-brand-dim">
          No dispute case yet. Build Round 1 letters from a report to start tracking rounds and item
          status. (Requires migration 030.)
        </p>
        {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border border-brand-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-brand-text">Dispute rounds</h3>
          <p className="mt-1 text-sm text-brand-dim">
            Track Round N continuity and per-tradeline outcomes across report uploads.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="text-xs font-semibold text-brand-dim hover:underline disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error && <p className="text-sm text-brand-red">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {snapshot.rounds.length === 0 ? (
          <span className="text-sm text-brand-dim">No rounds opened yet.</span>
        ) : (
          snapshot.rounds.map((round) => (
            <RoundChip
              key={round.id}
              round={round}
              active={snapshot.activeRound?.id === round.id}
              busy={busy}
              onStatus={(status) => void patch({ roundId: round.id, status })}
            />
          ))
        )}
      </div>

      <PendingQueue
        items={snapshot.pendingQueue}
        busy={busy}
        onStatus={(itemId, status) => void patch({ itemId, status })}
      />
    </div>
  )
}

function RoundChip({
  round,
  active,
  busy,
  onStatus,
}: {
  round: DisputeRoundRow
  active: boolean
  busy: boolean
  onStatus: (status: DisputeRoundStatus) => void
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs ${
        active ? 'border-accent bg-accent/10' : 'border-brand-border bg-neutral-50'
      }`}
    >
      <div className="font-bold text-brand-text">
        Round {round.round_number}
        <span className="ml-2 font-medium text-brand-dim">{roundStatusLabel(round.status)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {round.status !== 'mailed' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus('mailed')}
            className="rounded px-2 py-0.5 font-semibold border border-brand-border bg-white hover:bg-neutral-50 disabled:opacity-50"
          >
            Mark mailed
          </button>
        )}
        {round.status !== 'awaiting_response' && round.status !== 'closed' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus('awaiting_response')}
            className="rounded px-2 py-0.5 font-semibold border border-brand-border bg-white hover:bg-neutral-50 disabled:opacity-50"
          >
            Awaiting reply
          </button>
        )}
        {round.status !== 'closed' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus('closed')}
            className="rounded px-2 py-0.5 font-semibold border border-brand-border bg-white hover:bg-neutral-50 disabled:opacity-50"
          >
            Close
          </button>
        )}
      </div>
    </div>
  )
}

function PendingQueue({
  items,
  busy,
  onStatus,
}: {
  items: DisputeItemRow[]
  busy: boolean
  onStatus: (itemId: string, status: DisputeItemStatus) => void
}) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-brand-border bg-neutral-50 p-3">
        <p className="text-xs font-semibold text-brand-text">Needs next round</p>
        <p className="mt-1 text-xs text-brand-dim">No unresolved items yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-dim">
        Needs next round ({items.length})
      </p>
      <ul className="divide-y divide-brand-border rounded-lg border border-brand-border">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
            <span className="font-semibold text-brand-text">{item.creditor_name}</span>
            <span className="text-brand-dim">
              {BUREAU_LABELS[item.bureau]}
              {item.account_last4 ? ` ···${item.account_last4}` : ''}
            </span>
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-brand-dim">
              {itemStatusLabel(item.current_status)}
            </span>
            {item.last_round_number ? (
              <span className="text-brand-muted">R{item.last_round_number}</span>
            ) : null}
            <select
              disabled={busy}
              className="ml-auto rounded border border-brand-border bg-white px-2 py-1"
              value={item.current_status}
              onChange={(e) => onStatus(item.id, e.target.value as DisputeItemStatus)}
            >
              {ITEM_OUTCOMES.map((status) => (
                <option key={status} value={status}>
                  {itemStatusLabel(status)}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </div>
  )
}
