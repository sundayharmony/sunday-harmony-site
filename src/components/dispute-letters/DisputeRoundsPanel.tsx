'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  daysUntilDeadline,
  formatStatusHistory,
  itemStatusLabel,
  notYetDisputedFromItems,
  roundStatusLabel,
  type DisputeCfpbEscalationRow,
  type DisputeItemRow,
  type DisputeItemStatus,
  type DisputeLifecycleSnapshot,
  type DisputeMailMethod,
  type DisputePacketChecklist,
  type DisputeResponseRow,
  type DisputeRoundLetter,
  type DisputeRoundRow,
  type DisputeRoundStatus,
} from '@/lib/dispute-letters/dispute-lifecycle'
import { BUREAU_LABELS } from '@/lib/dispute-letters/types'
import { resetApplicationDisputeWork } from '@/lib/dispute-letters/client-api'

const ITEM_OUTCOMES: DisputeItemStatus[] = [
  'pending',
  'selected_for_round',
  'disputed',
  'deleted',
  'verified',
  'updated',
  'no_response',
  'frivolous',
  'withdrawn',
]

const MAIL_METHODS: DisputeMailMethod[] = ['certified', 'priority', 'other']

const PACKET_KEYS: { key: keyof DisputePacketChecklist; label: string }[] = [
  { key: 'letters_printed', label: 'Letters printed' },
  { key: 'photo_id', label: 'Photo ID' },
  { key: 'mail_proof', label: 'Proof of address' },
  { key: 'return_receipt', label: 'Return receipt' },
]

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function fromDateInputValue(value: string): string | null {
  if (!value.trim()) return null
  const d = new Date(`${value.trim()}T12:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export default function DisputeRoundsPanel({ applicationId }: { applicationId: string }) {
  const [snapshot, setSnapshot] = useState<DisputeLifecycleSnapshot | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [responses, setResponses] = useState<DisputeResponseRow[]>([])
  const [cfpbEscalations, setCfpbEscalations] = useState<DisputeCfpbEscalationRow[]>([])
  const [cfpbSelected, setCfpbSelected] = useState<string[]>([])
  const [cfpbDraft, setCfpbDraft] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)

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

      const activeId =
        data.activeRound?.id ||
        data.rounds[data.rounds.length - 1]?.id ||
        null
      if (activeId) {
        const rRes = await fetch(
          `/api/admin/dispute-letters/lifecycle/responses?roundId=${encodeURIComponent(activeId)}`
        )
        if (rRes.ok) {
          const rBody = await rRes.json()
          setResponses(Array.isArray(rBody.responses) ? rBody.responses : [])
        } else {
          setResponses([])
        }
      } else {
        setResponses([])
      }

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

  async function uploadResponse(roundId: string) {
    if (!uploadFile) return
    setBusy(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('roundId', roundId)
      fd.append('file', uploadFile)
      fd.append('source', 'bureau')
      const res = await fetch('/api/admin/dispute-letters/lifecycle/responses', {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Upload failed')
      }
      setUploadFile(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
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
  const selected = snapshot?.selectedQueue || []
  const letterGenerated = snapshot?.letterGeneratedQueue || []
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
          status. (Requires migrations 034–036.)
        </p>
        {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}
      </div>
    )
  }

  const uploadRound =
    snapshot.activeRound || snapshot.rounds[snapshot.rounds.length - 1] || null

  return (
    <div className="space-y-4 rounded-xl border border-brand-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-brand-text">Dispute rounds</h3>
          <p className="mt-1 text-sm text-brand-dim">
            Analysis identifies items. You select a round. Generating letters does not mark items
            disputed — confirming <span className="font-semibold">Sent</span> does. A round is
            complete only when every assigned item is Sent.
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
          snapshot.rounds.map((round) => (
            <RoundCard
              key={round.id}
              round={round}
              active={snapshot.activeRound?.id === round.id}
              busy={busy}
              sendProgress={
                snapshot.activeRound?.id === round.id ? progress : undefined
              }
              onStatus={(status) => void patch({ roundId: round.id, status })}
              onMail={(payload) => void patch({ roundId: round.id, ...payload })}
              onRelease={() => void patch({ roundId: round.id, releaseToClient: true })}
            />
          ))
        )}
      </div>

      {uploadRound && (
        <div className="rounded-lg border border-brand-border bg-neutral-50 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-dim">
            Response upload — Round {uploadRound.round_number}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              disabled={busy}
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="text-xs text-brand-dim"
            />
            <button
              type="button"
              disabled={busy || !uploadFile}
              onClick={() => void uploadResponse(uploadRound.id)}
              className="rounded px-2 py-1 text-xs font-semibold border border-brand-border bg-white hover:bg-neutral-50 disabled:opacity-50"
            >
              Upload response
            </button>
          </div>
          {responses.length > 0 && (
            <ul className="text-xs text-brand-dim space-y-1">
              {responses.map((r) => (
                <li key={r.id}>
                  {r.file_name} · {r.source}
                  {r.uploaded_by ? ` · ${r.uploaded_by}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <LetterSendQueue
        letters={snapshot.letters || []}
        progress={progress}
        busy={busy}
        onSent={(letterId) => void patch({ letterId, sent: true })}
      />

      {!hasCompletedRound && (
        <ItemStatusQueue
          title="Identified"
          empty="No remaining negatives or inquiries from the report."
          items={identified}
          busy={busy}
          onStatus={(itemId, status) => void patch({ itemId, status })}
        />
      )}

      <ItemStatusQueue
        title="Selected for this round"
        empty="Select accounts on Review to assign them to this round."
        items={selected}
        busy={busy}
        onStatus={(itemId, status) => void patch({ itemId, status })}
      />

      <ItemStatusQueue
        title="Letter generated"
        empty="Generate letters for the selected items. That does not mark them disputed."
        items={letterGenerated}
        busy={busy}
        onStatus={(itemId, status) => void patch({ itemId, status })}
      />

      <ItemStatusQueue
        title="Sent"
        empty="Mark each letter Sent after it is mailed. That is the official dispute."
        items={sent}
        busy={busy}
        onStatus={(itemId, status) => void patch({ itemId, status })}
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
        onStatus={(itemId, status) => void patch({ itemId, status })}
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
  active,
  busy,
  sendProgress,
  onStatus,
  onMail,
  onRelease,
}: {
  round: DisputeRoundRow
  active: boolean
  busy: boolean
  sendProgress?: { selected: number; sent: number; complete: boolean }
  onStatus: (status: DisputeRoundStatus) => void
  onMail: (payload: Record<string, unknown>) => void
  onRelease: () => void
}) {
  const checklist = round.packet_checklist || {}
  const deadlineDays = daysUntilDeadline(round.deadline_at)
  const [mailMethod, setMailMethod] = useState<DisputeMailMethod>(
    round.mail_method || 'certified'
  )
  const [trackingNumber, setTrackingNumber] = useState(round.tracking_number || '')
  const [deliveredAt, setDeliveredAt] = useState(toDateInputValue(round.delivered_at))

  useEffect(() => {
    setMailMethod(round.mail_method || 'certified')
    setTrackingNumber(round.tracking_number || '')
    setDeliveredAt(toDateInputValue(round.delivered_at))
  }, [round.id, round.mail_method, round.tracking_number, round.delivered_at])

  function toggleChecklist(key: keyof DisputePacketChecklist) {
    const next: DisputePacketChecklist = { ...checklist, [key]: !checklist[key] }
    onMail({ packetChecklist: next })
  }

  return (
    <div
      className={`rounded-lg border px-3 py-3 text-xs ${
        active ? 'border-accent bg-accent/10' : 'border-brand-border bg-neutral-50'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-bold text-brand-text">
            Round {round.round_number}
            <span className="ml-2 font-medium text-brand-dim">{roundStatusLabel(round.status)}</span>
          </div>
            {sendProgress && sendProgress.selected > 0 && (
              <p className="mt-0.5 text-brand-dim">
                {sendProgress.complete
                  ? `Complete — ${sendProgress.sent} of ${sendProgress.selected} Sent`
                  : `Incomplete — ${sendProgress.sent} of ${sendProgress.selected} Sent`}
              </p>
            )}
          {round.client_released_at && (
            <p className="mt-0.5 text-brand-dim">
              Released to client {new Date(round.client_released_at).toLocaleDateString()}
            </p>
          )}
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
        <div className="flex flex-wrap gap-1">
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
          {!round.client_released_at && (
            <button
              type="button"
              disabled={busy}
              onClick={onRelease}
              className="rounded px-2 py-0.5 font-semibold border border-accent bg-white text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              Release to client
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="block">
          <span className="text-brand-dim">Mail method</span>
          <select
            disabled={busy}
            value={mailMethod}
            onChange={(e) => setMailMethod(e.target.value as DisputeMailMethod)}
            className="mt-0.5 w-full rounded border border-brand-border bg-white px-2 py-1"
          >
            {MAIL_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-brand-dim">Tracking #</span>
          <input
            type="text"
            disabled={busy}
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            className="mt-0.5 w-full rounded border border-brand-border bg-white px-2 py-1"
            placeholder="Optional"
          />
        </label>
        <label className="block">
          <span className="text-brand-dim">Delivered</span>
          <input
            type="date"
            disabled={busy}
            value={deliveredAt}
            onChange={(e) => setDeliveredAt(e.target.value)}
            className="mt-0.5 w-full rounded border border-brand-border bg-white px-2 py-1"
          />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap gap-3">
        {PACKET_KEYS.map(({ key, label }) => (
          <label key={key} className="inline-flex items-center gap-1.5 text-brand-text">
            <input
              type="checkbox"
              disabled={busy}
              checked={Boolean(checklist[key])}
              onChange={() => toggleChecklist(key)}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onMail({
              mailMethod,
              trackingNumber: trackingNumber.trim() || null,
              deliveredAt: fromDateInputValue(deliveredAt),
              mailedAt: round.mailed_at || new Date().toISOString(),
              status: 'mailed',
              packetChecklist: checklist,
            })
          }
          className="rounded px-2 py-0.5 font-semibold border border-brand-border bg-white hover:bg-neutral-50 disabled:opacity-50"
        >
          Mark mailed
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onMail({
              mailMethod,
              trackingNumber: trackingNumber.trim() || null,
              deliveredAt: fromDateInputValue(deliveredAt),
              packetChecklist: checklist,
            })
          }
          className="rounded px-2 py-0.5 font-semibold border border-brand-border bg-white hover:bg-neutral-50 disabled:opacity-50"
        >
          Save mail details
        </button>
      </div>
    </div>
  )
}

function LetterSendQueue({
  letters,
  progress,
  busy,
  onSent,
}: {
  letters: DisputeRoundLetter[]
  progress: { selected: number; sent: number; complete: boolean }
  busy: boolean
  onSent: (letterId: string) => void
}) {
  if (!letters.length) return null
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-dim">
        Dispute letters ({letters.length})
      </p>
      {progress.selected > 0 && (
        <p className="text-xs text-brand-dim">
          {progress.complete
            ? `Round complete — all ${progress.sent} assigned items are Sent.`
            : `${progress.sent} of ${progress.selected} assigned items Sent. Generating a letter does not count as disputed.`}
        </p>
      )}
      <ul className="divide-y divide-brand-border rounded-lg border border-brand-border">
        {letters.map((letter) => (
          <li key={letter.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
            <span className="font-semibold text-brand-text">{letter.title}</span>
            {letter.sent_at ? (
              <span className="rounded bg-green-50 px-1.5 py-0.5 font-medium text-green-800">
                Sent {new Date(letter.sent_at).toLocaleDateString()}
              </span>
            ) : (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-brand-dim">
                Generated
              </span>
            )}
            <button
              type="button"
              disabled={busy || Boolean(letter.sent_at)}
              onClick={() => onSent(letter.id)}
              className="ml-auto rounded px-2 py-1 font-semibold border border-brand-border bg-white hover:bg-neutral-50 disabled:opacity-50"
            >
              {letter.sent_at ? 'Sent' : 'Mark sent'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ItemStatusQueue({
  title,
  empty,
  items,
  busy,
  onStatus,
}: {
  title: string
  empty: string
  items: DisputeItemRow[]
  busy: boolean
  onStatus: (itemId: string, status: DisputeItemStatus) => void
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
                <select
                  disabled={busy}
                  className="ml-auto rounded border border-brand-border bg-white px-2 py-1"
                  value={item.current_status}
                  onChange={(e) => onStatus(item.id, e.target.value as DisputeItemStatus)}
                >
                  {ITEM_OUTCOMES.map((status) => (
                    <option key={status} value={status}>
                      {itemStatusLabel(
                        status,
                        status === 'disputed' && item.current_status === 'disputed'
                          ? item.sent_at
                          : null
                      )}
                    </option>
                  ))}
                </select>
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
