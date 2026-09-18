'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BUREAU_OUTCOME_STATUSES,
  daysUntilDeadline,
  formatStatusHistory,
  itemStatusLabel,
  letterPackageDisplayCode,
  notYetDisputedFromItems,
  type DisputeCfpbEscalationRow,
  type DisputeItemRow,
  type DisputeItemStatus,
  type DisputeLifecycleSnapshot,
  type DisputeRoundRow,
  type LetterPackageSnapshot,
} from '@/lib/dispute-letters/dispute-lifecycle'
import { BUREAU_LABELS } from '@/lib/dispute-letters/types'
import { backfillHistoricalRound1, confirmLetterPackageSent, disputeLettersZipUrl, resetApplicationDisputeWork } from '@/lib/dispute-letters/client-api'

export default function DisputeRoundsPanel({ applicationId }: { applicationId: string }) {
  const [snapshot, setSnapshot] = useState<DisputeLifecycleSnapshot | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cfpbEscalations, setCfpbEscalations] = useState<DisputeCfpbEscalationRow[]>([])
  const [cfpbSelected, setCfpbSelected] = useState<string[]>([])
  const [cfpbDraft, setCfpbDraft] = useState('')

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
      const data = (await res.json()) as DisputeLifecycleSnapshot
      setSnapshot(data)

      const cRes = await fetch(
        `/api/admin/dispute-letters/lifecycle/cfpb?applicationUuid=${encodeURIComponent(applicationId)}`
      )
      if (cRes.ok) {
        const cBody = await cRes.json()
        const escalations = Array.isArray(cBody.escalations) ? cBody.escalations : []
        setCfpbEscalations(escalations)
        if (escalations[0]?.complaint_markdown) {
          setCfpbDraft(escalations[0].complaint_markdown)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dispute rounds')
      setSnapshot(null)
    }
  }, [applicationId])

  useEffect(() => {
    void load()
  }, [load])

  const unresolvedItems = useMemo(
    () =>
      (snapshot?.items || []).filter(
        (item) =>
          !['deleted', 'withdrawn', 'frivolous', 'pending', 'selected_for_round'].includes(
            item.current_status
          )
      ),
    [snapshot?.items]
  )

  const notYetDisputed = useMemo(
    () => snapshot?.notYetDisputed ?? notYetDisputedFromItems(snapshot?.items || []),
    [snapshot?.items, snapshot?.notYetDisputed]
  )

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

  async function saveCfpbDraft(options?: { regenerate?: boolean }) {
    if (!cfpbSelected.length) {
      setError('Select at least one unresolved item for the CFPB draft')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/dispute-letters/lifecycle/cfpb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationUuid: applicationId,
          itemIds: cfpbSelected,
          complaintMarkdown: options?.regenerate ? undefined : cfpbDraft.trim() || undefined,
          id: cfpbEscalations[0]?.id,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save CFPB draft')
      }
      const data = await res.json()
      if (data.escalation?.complaint_markdown) {
        setCfpbDraft(data.escalation.complaint_markdown)
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save CFPB draft')
    } finally {
      setBusy(false)
    }
  }

  const identified = snapshot?.identifiedQueue ?? notYetDisputed
  const sent = snapshot?.sentQueue || []
  const nextRound = snapshot?.nextRoundQueue || snapshot?.pendingQueue || []
  const progress = snapshot?.roundSendProgress || { selected: 0, sent: 0, complete: false }
  const hasCompletedRound = Boolean(snapshot?.hasCompletedRound)

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
          status. (Requires migrations 034–039.)
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
            Select items, generate letters, download the ZIP, then confirm the package was mailed.
            Status follows the package automatically — generating or downloading does not mark items
            Sent.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="text-xs font-semibold text-brand-dim hover:underline disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (
                !window.confirm(
                  'Record the original 3-bureau report as mailed Round 1, and treat later bureau PDFs as bureau responses/updates? This does not delete reports.'
                )
              ) {
                return
              }
              void (async () => {
                setBusy(true)
                setError('')
                try {
                  await backfillHistoricalRound1({ applicationUuid: applicationId })
                  await load()
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Failed to backfill Round 1')
                } finally {
                  setBusy(false)
                }
              })()
            }}
            className="text-xs font-semibold text-brand-dim hover:underline disabled:opacity-50"
          >
            Record prior Round 1
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (
                !window.confirm(
                  'Delete all uploaded reports, generated letters, and dispute round history for this client? This returns to before the first report was uploaded.'
                )
              ) {
                return
              }
              void (async () => {
                setBusy(true)
                setError('')
                try {
                  await resetApplicationDisputeWork(applicationId)
                  await load()
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Failed to reset dispute work')
                } finally {
                  setBusy(false)
                }
              })()
            }}
            className="text-xs font-semibold text-brand-red hover:underline disabled:opacity-50"
          >
            Reset to before first report
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-brand-red">{error}</p>}

      <div className="space-y-3">
        {snapshot.rounds.length === 0 ? (
          <span className="text-sm text-brand-dim">No rounds opened yet.</span>
        ) : (
          snapshot.rounds.map((round) => {
            const pkg =
              snapshot.packages?.find((row) => row.package.round_id === round.id && row.package.is_active) ||
              snapshot.packages?.find((row) => row.package.round_id === round.id) ||
              (snapshot.activeRound?.id === round.id ? snapshot.activePackage : null) ||
              null
            return (
            <RoundCard
              key={round.id}
              round={round}
              pkg={pkg}
              active={snapshot.activeRound?.id === round.id}
              sendProgress={
                snapshot.activeRound?.id === round.id ? progress : undefined
              }
            />
            )
          })
        )}
      </div>

      <LetterPackageCard
        pkg={snapshot.activePackage}
        sessionId={snapshot.activeRound?.session_id || null}
        busy={busy}
        onRefresh={() => void load()}
        onError={setError}
        setBusy={setBusy}
      />

      {!hasCompletedRound && (
        <ItemStatusQueue
          title="Identified"
          empty="No remaining negatives or inquiries from the report."
          items={identified}
        />
      )}

      <ItemStatusQueue
        title="Sent"
        empty="Confirm the letter package after it is mailed. That is the official dispute."
        items={sent}
      />

      <ItemStatusQueue
        title="Needs next round"
        empty={
          hasCompletedRound
            ? 'Nothing remaining after the last sent round.'
            : 'After this round is fully Sent and new reports are analyzed, remaining and new items appear here.'
        }
        items={nextRound}
        busy={busy}
        onOutcome={(itemId, status) => void patch({ itemId, status })}
      />

      <div className="rounded-lg border border-brand-border bg-neutral-50 p-3 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-dim">
            CFPB complaint draft
          </p>
          <p className="mt-1 text-xs text-brand-dim">
            Pick unresolved items, generate a draft, then have the client submit on
            consumerfinance.gov.
          </p>
        </div>
        <ul className="max-h-40 overflow-y-auto space-y-1">
          {unresolvedItems.length === 0 ? (
            <li className="text-xs text-brand-dim">No items available.</li>
          ) : (
            unresolvedItems.map((item) => {
              const checked = cfpbSelected.includes(item.id)
              return (
                <li key={item.id}>
                  <label className="flex items-start gap-2 text-xs text-brand-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy}
                      onChange={() =>
                        setCfpbSelected((prev) =>
                          checked ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                        )
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-semibold">{item.creditor_name}</span>
                      <span className="text-brand-dim">
                        {' '}
                        {BUREAU_LABELS[item.bureau]}
                        {item.account_last4 ? ` ···${item.account_last4}` : ''} —{' '}
                        {itemStatusLabel(item.current_status, item.sent_at)}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })
          )}
        </ul>
        <textarea
          value={cfpbDraft}
          onChange={(e) => setCfpbDraft(e.target.value)}
          disabled={busy}
          rows={8}
          placeholder="Generate or paste CFPB complaint markdown…"
          className="w-full rounded border border-brand-border bg-white px-2 py-1.5 text-xs text-brand-text"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !cfpbSelected.length}
            onClick={() => void saveCfpbDraft({ regenerate: true })}
            className="rounded px-2 py-1 text-xs font-semibold border border-brand-border bg-white hover:bg-neutral-50 disabled:opacity-50"
          >
            Generate &amp; save draft
          </button>
          <button
            type="button"
            disabled={busy || !cfpbSelected.length}
            onClick={() => void saveCfpbDraft()}
            className="rounded px-2 py-1 text-xs font-semibold border border-brand-border bg-white hover:bg-neutral-50 disabled:opacity-50"
          >
            Save draft
          </button>
        </div>
        {cfpbEscalations[0] && (
          <p className="text-xs text-brand-dim">
            Latest escalation: {cfpbEscalations[0].status}
            {cfpbEscalations[0].updated_at
              ? ` · updated ${new Date(cfpbEscalations[0].updated_at).toLocaleString()}`
              : ''}
          </p>
        )}
      </div>
    </div>
  )
}

function RoundCard({
  round,
  pkg,
  active,
  sendProgress,
}: {
  round: DisputeRoundRow
  pkg: LetterPackageSnapshot | null
  active: boolean
  sendProgress?: { selected: number; sent: number; complete: boolean }
}) {
  const deadlineDays = daysUntilDeadline(round.deadline_at)

  return (
    <div
      className={`rounded-lg border px-3 py-3 text-xs ${
        active ? 'border-accent bg-accent/10' : 'border-brand-border bg-neutral-50'
      }`}
    >
      <div className="font-bold text-brand-text">
        Round {round.round_number}
        <span className="ml-2 font-medium text-brand-dim">
          {pkg?.workflow.label ||
            (sendProgress?.complete
              ? 'Complete'
              : round.status === 'draft'
                ? 'Draft'
                : 'Letters generated')}
        </span>
      </div>
      {pkg ? (
        <p className="mt-0.5 text-brand-dim">
          {pkg.generatedCount} letter{pkg.generatedCount === 1 ? '' : 's'}
          {pkg.downloaded ? ' · ZIP Downloaded ✓' : ''}
          {pkg.allSent
            ? ' · All sent'
            : pkg.pendingCount
              ? ` · ${pkg.pendingCount} ready to send`
              : ''}
        </p>
      ) : sendProgress && sendProgress.selected > 0 ? (
        <p className="mt-0.5 text-brand-dim">
          {sendProgress.complete
            ? `Complete — ${sendProgress.sent} of ${sendProgress.selected} Sent`
            : `${sendProgress.sent} of ${sendProgress.selected} Sent`}
        </p>
      ) : null}
      {round.deadline_at && (
        <p className="mt-0.5 text-brand-dim">
          Deadline {new Date(round.deadline_at).toLocaleDateString()}
          {deadlineDays != null
            ? deadlineDays >= 0
              ? ` · ${deadlineDays} day${deadlineDays === 1 ? '' : 's'} left`
              : ` · ${Math.abs(deadlineDays)} day${Math.abs(deadlineDays) === 1 ? '' : 's'} overdue`
            : ''}
        </p>
      )}
    </div>
  )
}

function LetterPackageCard({
  pkg,
  sessionId,
  busy,
  onRefresh,
  onError,
  setBusy,
}: {
  pkg: LetterPackageSnapshot | null | undefined
  sessionId: string | null
  busy: boolean
  onRefresh: () => void
  onError: (message: string) => void
  setBusy: (busy: boolean) => void
}) {
  const [expanded, setExpanded] = useState(true)
  if (!pkg) return null
  const workflow = pkg.workflow
  const display = letterPackageDisplayCode(pkg.package.id)
  const packageId = pkg.package.id
  const packageVersion = pkg.package.version
  const generatedCount = pkg.generatedCount
  const downloaded = pkg.downloaded
  const allSent = pkg.allSent
  const members = pkg.members

  async function downloadZip() {
    if (!sessionId) return
    setBusy(true)
    onError('')
    try {
      const res = await fetch(disputeLettersZipUrl(sessionId))
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === 'string' ? body.error : 'ZIP download failed')
      }
      const blob = await res.blob()
      const header = res.headers.get('content-disposition') || ''
      const matched = /filename="([^"]+)"/i.exec(header)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = matched?.[1] || 'Dispute Letters.zip'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      onRefresh()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'ZIP download failed')
    } finally {
      setBusy(false)
    }
  }

  async function confirmAll() {
    setBusy(true)
    onError('')
    try {
      await confirmLetterPackageSent({ packageId, sessionId: sessionId || undefined })
      onRefresh()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to confirm letters sent')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-brand-border bg-white p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-dim">
            Letter package {display}
            {packageVersion > 1 ? ` · v${packageVersion}` : ''}
          </p>
          <p className="mt-1 text-sm font-semibold text-brand-text">{workflow.label}</p>
          <p className="mt-0.5 text-xs text-brand-dim">
            {generatedCount} letter{generatedCount === 1 ? '' : 's'} generated
            {downloaded ? ' · ZIP Downloaded ✓' : ''}
            {allSent ? ' · Sent confirmation recorded' : downloaded ? ' · Ready to Send' : ''}
            {' · Photo ID and proof of address are in each letter'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {sessionId && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void downloadZip()}
              className="rounded px-2 py-1 text-xs font-semibold border border-brand-border bg-white hover:bg-neutral-50 disabled:opacity-50"
            >
              {downloaded ? 'Download again' : 'Download ZIP'}
            </button>
          )}
          {!allSent && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmAll()}
              className="rounded px-2 py-1 text-xs font-semibold border border-green-700 bg-green-50 text-green-900 hover:bg-green-100 disabled:opacity-50"
            >
              Confirm All Letters Sent
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className="rounded px-2 py-1 text-xs font-semibold text-brand-dim hover:underline"
          >
            {expanded ? 'Hide details' : 'Show details'}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-brand-dim">
                <th className="py-1 pr-3 font-semibold">Item</th>
                <th className="py-1 pr-3 font-semibold">Letter</th>
                <th className="py-1 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {members.map((member) => (
                <tr key={`${member.package_id}-${member.item_id}`}>
                  <td className="py-1.5 pr-3 text-brand-text">
                    <span className="font-semibold">{member.creditor_name}</span>
                    <span className="text-brand-dim">
                      {' '}
                      {BUREAU_LABELS[member.bureau]}
                      {member.account_last4 ? ` ···${member.account_last4}` : ''}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-brand-dim">{member.letter_title || 'Generated'}</td>
                  <td className="py-1.5">
                    {member.sent_at ? (
                      <span className="font-medium text-green-800">✓ Sent</span>
                    ) : (
                      <span className="text-brand-dim">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ItemStatusQueue({
  title,
  empty,
  items,
  busy,
  onOutcome,
}: {
  title: string
  empty: string
  items: DisputeItemRow[]
  busy?: boolean
  onOutcome?: (itemId: string, status: DisputeItemStatus) => void
}) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-brand-border bg-neutral-50 p-3">
        <p className="text-xs font-semibold text-brand-text">{title}</p>
        <p className="mt-1 text-xs text-brand-dim">{empty}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-dim">
        {title} ({items.length})
      </p>
      <ul className="divide-y divide-brand-border rounded-lg border border-brand-border">
        {items.map((item) => {
          const history = formatStatusHistory(item.status_history)
          return (
            <li key={item.id} className="px-3 py-2 text-xs space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-brand-text">{item.creditor_name}</span>
                <span className="text-brand-dim">
                  {BUREAU_LABELS[item.bureau]}
                  {item.account_last4 ? ` ···${item.account_last4}` : ''}
                </span>
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-brand-dim">
                  {itemStatusLabel(item.current_status, item.sent_at)}
                </span>
                {item.last_round_number ? (
                  <span className="text-brand-muted">R{item.last_round_number}</span>
                ) : null}
                {item.sent_at ? (
                  <span className="text-brand-muted">
                    Sent {new Date(item.sent_at).toLocaleDateString()}
                  </span>
                ) : null}
                {onOutcome &&
                (item.sent_at ||
                  BUREAU_OUTCOME_STATUSES.includes(item.current_status)) ? (
                  <select
                    disabled={busy}
                    className="ml-auto rounded border border-brand-border bg-white px-2 py-1"
                    value={
                      BUREAU_OUTCOME_STATUSES.includes(item.current_status)
                        ? item.current_status
                        : 'verified'
                    }
                    onChange={(e) => onOutcome(item.id, e.target.value as DisputeItemStatus)}
                  >
                    {BUREAU_OUTCOME_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {itemStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              {history.length > 0 && (
                <p className="text-[11px] text-brand-muted">{history.join(' → ')}</p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
