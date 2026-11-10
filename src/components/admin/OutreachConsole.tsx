'use client'

import { useCallback, useEffect, useState } from 'react'
import StatusBadge from '@/components/ui/StatusBadge'

type Blocker = { code: string; message: string }

type DeskRow = {
  id: string
  business: string
  email: string
  status: string
  reason?: string
  deliveryState: string
  deliveryLabel?: string
  acceptedAt: string | null
  contactedAt: string | null
  subject: string
  attachment?: string
}

type LetterPreview = DeskRow & {
  previewHtml?: string
  previewText?: string
  deliveredAt?: string | null
  bouncedAt?: string | null
  attachment: string
  phone: string | null
  booking: { status: string; startsAt: string | null }
}

type ConsolePayload = {
  disabled: boolean
  liveSend?: boolean
  storage: string
  senderConfigured: boolean
  canOperate?: boolean
  attachmentPresent?: boolean
  readyCount?: number
  deferredCount?: number
  readyTarget?: number
  manualSendMax?: number
  next: LetterPreview | null
  sent: DeskRow[]
  settings: {
    killSwitch: boolean
    activatedAt?: string | null
    physicalMailingAddress: string | null
    senderEmail: string
    signerName: string
    companyName: string
    ctaUrl: string
    historyReconciliationStatus: string
    optOutVerifiedAt?: string | null
    settingsVersion?: number
  }
  template: { approved: boolean; version: number } | null
  blockers: Blocker[]
  reconciliation: Array<{
    business: string
    email?: string | null
    outcome: string
    providerConfirmed?: boolean
    notes: string
  }>
  provider: { intended: string; idempotencyRecovery: boolean; note: string }
  scheduler?: { enabled: boolean; note: string }
  error?: string
}

function formatWhen(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export default function OutreachConsole() {
  const [data, setData] = useState<ConsolePayload | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [address, setAddress] = useState('')
  const [lastSend, setLastSend] = useState('')
  const [sentPreview, setSentPreview] = useState<LetterPreview | null>(null)
  const [openSentId, setOpenSentId] = useState<string | null>(null)
  const [sendCount, setSendCount] = useState(1)

  const load = useCallback(async (preserveError = false) => {
    if (!preserveError) setError('')
    try {
      const response = await fetch('/api/admin/outreach', {
        cache: 'no-store',
        // Desk refill can examine several leads; keep this above page-load work.
        signal: AbortSignal.timeout(90000),
      })
      if (response.status === 401 || response.status === 403) {
        setError('You do not have access to outreach review.')
        return
      }
      if (!response.ok) {
        setError('Outreach did not respond. Try again.')
        return
      }
      const payload = (await response.json()) as ConsolePayload
      if (!payload.settings || !payload.provider) {
        setError(payload.error || 'Outreach did not finish loading.')
        return
      }
      setData(payload)
      setAddress(payload.settings.physicalMailingAddress || '')
      if (payload.error) setError(payload.error)
    } catch {
      setError('Outreach is taking too long to load. Try again.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!openSentId) {
      setSentPreview(null)
      return
    }
    let cancelled = false
    void fetch(`/api/admin/outreach/${openSentId}`)
      .then(async (response) => {
        if (!response.ok) return null
        return (await response.json()) as LetterPreview
      })
      .then((item) => {
        if (!cancelled) setSentPreview(item)
      })
      .catch(() => {
        if (!cancelled) setSentPreview(null)
      })
    return () => {
      cancelled = true
    }
  }, [openSentId])

  async function post(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action)
    setError('')
    try {
      const response = await fetch('/api/admin/outreach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const payload = (await response.json()) as {
        error?: string
        message?: string
        sent?: number
        enqueued?: number
        details?: string[]
        blockers?: Array<{ code?: string; message?: string }>
      }
      if (!response.ok && payload.error) setError(payload.error)
      if (action === 'enqueue' && response.ok) {
        const added = Number(payload.enqueued || 0)
        setLastSend(
          added > 0
            ? `Added ${added} letter${added === 1 ? '' : 's'} to the ready queue.`
            : 'Queue already had ready letters, or no new eligible prospects were left to draft.'
        )
      }
      if ((action === 'send' || action === 'send-batch') && response.ok) {
        const sent = Number(payload.sent || 0)
        const blockers = payload.blockers || []
        const detailHint = (payload.details || []).filter(Boolean).slice(0, 3).join(', ')
        setLastSend(
          sent > 0
            ? sent === 1
              ? 'Gmail accepted this email. That is not delivered. The next letter is now ready.'
              : `Gmail accepted ${sent} emails. That is not delivered. The queue has been refilled where possible.`
            : payload.message ||
                (blockers.length
                  ? `Not sent. ${blockers.map((item) => item.message || item.code).filter(Boolean).join(' ')}`
                  : detailHint
                    ? `Not sent (${detailHint}).`
                    : 'Not sent. No claimable letter was in the ready queue.')
        )
        setOpenSentId(null)
      }
      await load(true)
    } finally {
      setBusy('')
    }
  }

  if (!data) {
    return (
      <div className="max-w-3xl space-y-3">
        <p className="text-sm text-brand-muted">{error || 'Loading outreach…'}</p>
        {error ? (
          <button
            type="button"
            onClick={() => void load()}
            className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-brand-border bg-white text-sm font-semibold text-brand-text"
          >
            Try again
          </button>
        ) : null}
      </div>
    )
  }

  const canOperate = Boolean(data.canOperate)
  const next = data.next ?? null
  const sent = data.sent ?? []
  const readyCount = data.readyCount ?? 0
  const deferredCount = data.deferredCount ?? 0
  const readyTarget = data.readyTarget ?? 10
  const manualSendMax = data.manualSendMax ?? 50
  // Manual send ignores brief retry backoff, so deferred pending letters are still sendable.
  const sendableCount = readyCount + deferredCount
  const maxSendCount = Math.max(1, Math.min(Math.max(sendableCount, next ? 1 : 0), manualSendMax))
  const effectiveSendCount = Math.min(Math.max(1, sendCount), maxSendCount)
  const canSend = canOperate && Boolean(data.liveSend) && Boolean(next)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-brand-dim">Sales review</p>
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mt-1">Prospect outreach</h1>
        <p className="text-sm text-brand-muted mt-2">
          Enter how many emails to send from the queue. {readyTarget} stay queued so the next preview is
          always ready.
        </p>
      </div>

      <div className="rounded-xl border border-brand-border bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <StatusBadge status={data.liveSend ? 'active' : 'paused'} />
          <span className="text-sm text-brand-text">
            {readyCount} ready
            {readyCount < readyTarget ? ` (target ${readyTarget})` : ''}
            {deferredCount > 0 ? ` · ${deferredCount} waiting on retry` : ''}
            {sent.length ? ` · ${sent.length} sent` : ''}
          </span>
        </div>
        {!data.liveSend && data.blockers.length > 0 ? (
          <p className="text-sm text-brand-muted">
            Live send is off: {data.blockers.map((item) => item.message).join(' ')}
          </p>
        ) : (
          <p className="text-sm text-brand-muted">{data.provider.note}</p>
        )}
        {error ? <p className="text-sm text-brand-red mt-2">{error}</p> : null}
        {lastSend ? <p className="text-sm text-brand-text mt-2">{lastSend}</p> : null}
      </div>

      <section className="rounded-xl border border-brand-border bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-brand-dim">Next in line</p>
            <h2 className="text-lg font-bold text-brand-text mt-1">
              {next?.business || 'No letter ready'}
            </h2>
            {next ? (
              <p className="text-sm text-brand-muted mt-1">
                {next.email}
                {readyCount > 1 ? ` · ${readyCount - 1} more after this` : ''}
              </p>
            ) : (
              <p className="text-sm text-brand-muted mt-1">
                Use Fill queue to recover soft failures and draft the next eligible prospects.
              </p>
            )}
          </div>
          {canOperate ? (
            <div className="flex flex-col sm:flex-row sm:items-end gap-2 w-full sm:w-auto">
              {readyCount < readyTarget ? (
                <button
                  type="button"
                  onClick={() => void post('enqueue')}
                  disabled={Boolean(busy)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-brand-border bg-white text-sm font-semibold text-brand-text disabled:opacity-60"
                >
                  {busy === 'enqueue' ? 'Filling…' : 'Fill queue'}
                </button>
              ) : null}
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-brand-dim">Count</span>
                <input
                  type="number"
                  min={1}
                  max={maxSendCount}
                  value={effectiveSendCount}
                  onChange={(event) => {
                    const nextValue = Number.parseInt(event.target.value, 10)
                    if (Number.isFinite(nextValue)) setSendCount(nextValue)
                  }}
                  disabled={Boolean(busy)}
                  aria-label="How many emails to send"
                  className="w-full sm:w-20 rounded-lg border border-brand-border px-3 py-2.5 text-sm text-brand-text"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!next) return
                  const count = effectiveSendCount
                  const prompt =
                    count === 1
                      ? `Send this email to ${next.business} now?\n\nOK starts the send. Gmail “accepted” only means Gmail took the message — it is not proof of delivery.`
                      : `Send ${count} emails from the queue now, starting with ${next.business}?\n\nOK starts the send. Gmail “accepted” only means Gmail took each message — it is not proof of delivery.`
                  if (!window.confirm(prompt)) return
                  void post('send', { count })
                }}
                disabled={Boolean(busy) || !canSend}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-60"
              >
                {busy === 'send' || busy === 'send-batch'
                  ? 'Sending…'
                  : effectiveSendCount === 1
                    ? 'Send'
                    : `Send ${effectiveSendCount}`}
              </button>
            </div>
          ) : null}
        </div>

        {next ? (
          <>
            <p className="text-sm text-brand-text font-medium">{next.subject}</p>
            {next.previewHtml ? (
              <iframe
                title="Formatted email preview"
                srcDoc={next.previewHtml}
                sandbox=""
                className="w-full h-[28rem] sm:h-[36rem] rounded-lg border border-brand-border bg-white"
              />
            ) : next.previewText ? (
              <pre className="whitespace-pre-wrap text-sm text-brand-muted bg-neutral-50 border border-brand-border rounded-lg p-3">
                {next.previewText}
              </pre>
            ) : (
              <p className="text-sm text-brand-muted">Letter preview is empty.</p>
            )}
            <p className="text-xs text-brand-dim">Attachment: {next.attachment}</p>
          </>
        ) : null}
      </section>

      <section className="rounded-xl border border-brand-border bg-white overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-brand-border">
          <h2 className="text-sm font-bold text-brand-text">Previously sent</h2>
        </div>
        {sent.length === 0 ? (
          <p className="px-4 sm:px-5 py-6 text-sm text-brand-muted">No emails have been accepted by Gmail yet.</p>
        ) : (
          <ul>
            {sent.map((row) => (
              <li key={row.id} className="border-t border-brand-border first:border-t-0">
                <button
                  type="button"
                  className="w-full text-left px-4 sm:px-5 py-3 hover:bg-neutral-50"
                  onClick={() => setOpenSentId((current) => (current === row.id ? null : row.id))}
                >
                  <span className="block font-medium text-brand-text">{row.business}</span>
                  <span className="block text-xs text-brand-muted mt-0.5">
                    {row.deliveryLabel || row.deliveryState}
                    {row.acceptedAt ? ` · ${formatWhen(row.acceptedAt)} ET` : ''}
                  </span>
                  <span className="block text-xs text-brand-dim mt-0.5">{row.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {openSentId ? (
          <div className="border-t border-brand-border p-4 sm:p-5 space-y-2">
            <p className="text-sm font-medium text-brand-text">{sentPreview?.subject || 'Loading sent letter…'}</p>
            {sentPreview?.previewHtml ? (
              <iframe
                title="Sent email preview"
                srcDoc={sentPreview.previewHtml}
                sandbox=""
                className="w-full h-[22rem] sm:h-[28rem] rounded-lg border border-brand-border bg-white"
              />
            ) : sentPreview?.previewText ? (
              <pre className="whitespace-pre-wrap text-sm text-brand-muted bg-neutral-50 border border-brand-border rounded-lg p-3">
                {sentPreview.previewText}
              </pre>
            ) : (
              <p className="text-sm text-brand-muted">Loading letter…</p>
            )}
          </div>
        ) : null}
      </section>

      {canOperate ? (
        <details className="rounded-xl border border-brand-border bg-white p-4 sm:p-5">
          <summary className="text-sm font-bold text-brand-text cursor-pointer">Admin settings</summary>
          <div className="mt-4 space-y-4">
            <p className="text-xs text-brand-muted">
              Saving a mailing address invalidates template approval. Client checkboxes cannot mark schema,
              sender, history, or opt-out as verified.
            </p>
            {data.blockers.length > 0 ? (
              <ul className="space-y-2">
                {data.blockers.map((blocker) => (
                  <li key={blocker.code} className="text-sm text-brand-text border border-brand-border rounded-lg px-3 py-2">
                    <span className="font-semibold">{blocker.code}</span>
                    <span className="block text-brand-muted text-xs mt-1">{blocker.message}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-brand-dim">Physical mailing address</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 text-sm"
                rows={2}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            </label>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void post('update-settings', {
                  physicalMailingAddress: address,
                  schemaReady: true,
                  senderConfigured: true,
                  historyReconciled: true,
                })}
                disabled={Boolean(busy)}
                className="px-4 py-2 rounded-lg border border-brand-border bg-white text-sm font-semibold"
              >
                Save settings
              </button>
              <button
                type="button"
                onClick={() => void post('approve-template')}
                disabled={Boolean(busy)}
                className="px-4 py-2 rounded-lg border border-brand-border bg-white text-sm font-semibold"
              >
                Record template review
              </button>
              <button
                type="button"
                onClick={() => void post('verify-opt-out')}
                disabled={Boolean(busy)}
                className="px-4 py-2 rounded-lg border border-brand-border bg-white text-sm font-semibold"
              >
                Verify opt-out
              </button>
              <button
                type="button"
                onClick={() => void post('set-kill-switch', { killSwitch: !data.settings.killSwitch })}
                disabled={Boolean(busy)}
                className="px-4 py-2 rounded-lg border border-brand-border bg-white text-sm font-semibold"
              >
                {data.settings.killSwitch ? 'Turn database kill switch off' : 'Turn database kill switch on'}
              </button>
              <button
                type="button"
                onClick={() => void post('activate', { schemaReady: true, senderConfigured: true, historyReconciled: true })}
                disabled={Boolean(busy)}
                className="px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-sm font-semibold text-red-800"
              >
                Record activation (server gates only)
              </button>
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-text mb-2">Unverified historical reports</h3>
              <p className="text-xs text-brand-muted mb-3">
                Email Bot assertions. Not provider-confirmed. They block review and must not duplicate sends.
              </p>
              <ul className="space-y-2">
                {data.reconciliation.map((row) => (
                  <li key={`${row.business}-${row.email || 'name'}`} className="text-sm border border-brand-border rounded-lg px-3 py-2">
                    <span className="font-medium text-brand-text">{row.business}</span>
                    <span className="text-brand-muted"> · {row.outcome}</span>
                    {row.email ? <span className="block text-xs text-brand-dim">{row.email}</span> : null}
                    <span className="block text-xs text-brand-muted mt-1">{row.notes}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      ) : null}
    </div>
  )
}
