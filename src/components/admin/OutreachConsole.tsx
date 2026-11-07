'use client'

import { useCallback, useEffect, useState } from 'react'
import StatusBadge from '@/components/ui/StatusBadge'

type Blocker = { code: string; message: string }
type QueueRow = {
  id: string
  business: string
  email: string
  status: string
  reason: string
  deliveryState: string
  deliveryLabel?: string
  acceptedAt: string | null
  contactedAt: string | null
  subject: string
  attachment: string
}

type Preview = {
  id: string
  subject: string
  previewHtml?: string
  previewText?: string
  deliveryLabel?: string
  acceptedAt: string | null
  deliveredAt?: string | null
  bouncedAt?: string | null
  contactedAt: string | null
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
  sentToday?: number
  settings: {
    killSwitch: boolean
    activatedAt?: string | null
    physicalMailingAddress: string | null
    senderEmail: string
    signerName: string
    companyName: string
    ctaUrl: string
    dailySendLimit: number
    historyReconciliationStatus: string
    optOutVerifiedAt?: string | null
    settingsVersion?: number
  }
  template: { approved: boolean; version: number } | null
  blockers: Blocker[]
  queue: QueueRow[]
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

export default function OutreachConsole() {
  const [data, setData] = useState<ConsolePayload | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [address, setAddress] = useState('')
  const [dailyCap, setDailyCap] = useState('0')
  const [lastSend, setLastSend] = useState('')

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/outreach')
    if (response.status === 401 || response.status === 403) {
      setError('You do not have access to outreach review.')
      return
    }
    const payload = (await response.json()) as ConsolePayload
    setData(payload)
    setAddress(payload.settings.physicalMailingAddress || '')
    setDailyCap(String(payload.settings.dailySendLimit ?? 0))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selected = data?.queue.find((row) => row.id === openId) || data?.queue[0] || null
  const selectedId = selected?.id ?? null

  useEffect(() => {
    if (!selectedId) {
      setPreview(null)
      return
    }
    let cancelled = false
    void fetch(`/api/admin/outreach/${selectedId}`)
      .then(async (response) => {
        if (!response.ok) return null
        return (await response.json()) as Preview
      })
      .then((item) => {
        if (!cancelled) setPreview(item)
      })
      .catch(() => {
        if (!cancelled) setPreview(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

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
        sent?: number
        blockers?: Array<{ code?: string; message?: string }>
      }
      if (!response.ok && payload.error) setError(payload.error)
      if (action === 'send-batch' && response.ok) {
        const sent = Number(payload.sent || 0)
        const blockers = payload.blockers || []
        setLastSend(
          sent > 0
            ? `Gmail accepted ${sent} email${sent === 1 ? '' : 's'} from this batch. That is not delivered.`
            : blockers.length
              ? `No emails sent. ${blockers.map((item) => item.message || item.code).filter(Boolean).join(' ')}`
              : 'No emails sent. The pending queue may be empty or already at the daily cap.'
        )
      }
      await load()
    } finally {
      setBusy('')
    }
  }

  if (!data) {
    return <p className="text-sm text-brand-muted">{error || 'Loading outreach review…'}</p>
  }

  const canOperate = Boolean(data.canOperate)
  const readyCount = data.readyCount ?? data.queue.filter((row) => row.status === 'pending').length
  const cap = data.settings.dailySendLimit ?? 0
  const sentToday = data.sentToday ?? 0

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-brand-dim">Sales review</p>
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mt-1">Prospect outreach</h1>
        <p className="text-sm text-brand-muted mt-2 max-w-2xl">
          {data.liveSend
            ? 'Prepare the queue, preview the branded letter, then send a batch. Gmail accepted is not delivered.'
            : 'Disabled automation. Queue and previews only. Live Gmail send stays off until every server-side gate is satisfied.'}
        </p>
      </div>

      <div className="rounded-xl border border-brand-border bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <StatusBadge status={data.liveSend ? 'active' : 'paused'} />
          <span className="text-sm text-brand-text">
            {readyCount} ready · {sentToday} Gmail accepted today
            {cap > 0 ? ` / ${cap} cap` : ''}
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

      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void post('enqueue')}
          disabled={Boolean(busy)}
          className="px-4 py-2 rounded-lg bg-brand-text text-white text-sm font-semibold disabled:opacity-60"
        >
          {busy === 'enqueue' ? 'Queueing…' : 'Prepare queue (no send)'}
        </button>
        {canOperate ? (
          <button
            type="button"
            onClick={() => {
              if (
                !window.confirm(
                  'Send up to 10 outreach emails from the pending queue now? Gmail accepted is not delivered. This uses the daily cap and cannot be undone.'
                )
              ) {
                return
              }
              void post('send-batch')
            }}
            disabled={Boolean(busy)}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-60"
          >
            {busy === 'send-batch' ? 'Sending…' : 'Send batch'}
          </button>
        ) : null}
      </div>

      <section className="rounded-xl border border-brand-border bg-white overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-brand-border">
          <h2 className="text-sm font-bold text-brand-text">Queue</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-brand-dim">
              <tr>
                <th className="px-4 py-2">Business</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Gmail</th>
                <th className="px-4 py-2 hidden sm:table-cell">Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.queue.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-brand-muted" colSpan={4}>
                    No queued prospects yet. Prepare queue after the migration is applied, or review blockers.
                  </td>
                </tr>
              ) : (
                data.queue.map((row) => (
                  <tr key={row.id} className="border-t border-brand-border">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-left font-medium text-brand-text underline-offset-2 hover:underline"
                        onClick={() => setOpenId(row.id)}
                      >
                        {row.business}
                      </button>
                      <div className="text-xs text-brand-muted">{row.email}</div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3">{row.deliveryLabel || row.deliveryState}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-brand-muted">{row.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <section className="rounded-xl border border-brand-border bg-white p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-bold text-brand-text">Preview and handoff</h2>
          <p className="text-sm text-brand-text font-medium">{preview?.subject || selected.subject}</p>
          <p className="text-xs text-brand-muted">
            {preview?.deliveryLabel || selected.deliveryLabel || selected.deliveryState}
            {preview?.acceptedAt ? ` · Gmail accepted ${preview.acceptedAt}` : ''}
            {preview?.deliveredAt ? ` · Delivered ${preview.deliveredAt}` : ''}
            {preview?.bouncedAt ? ` · Bounced ${preview.bouncedAt}` : ''}
          </p>
          {preview?.previewHtml ? (
            <iframe
              title="Formatted email preview"
              srcDoc={preview.previewHtml}
              sandbox=""
              className="w-full h-[28rem] sm:h-[36rem] rounded-lg border border-brand-border bg-white"
            />
          ) : preview?.previewText ? (
            <pre className="whitespace-pre-wrap text-sm text-brand-muted bg-neutral-50 border border-brand-border rounded-lg p-3">
              {preview.previewText}
            </pre>
          ) : (
            <p className="text-sm text-brand-muted">Loading letter…</p>
          )}
          <p className="text-xs text-brand-dim">Attachment: {preview?.attachment || selected.attachment}</p>
          {preview ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-dim">Phone on file</dt>
                <dd>{preview.phone || 'None stored'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-dim">Booking</dt>
                <dd>{preview.booking.status}{preview.booking.startsAt ? ` · ${preview.booking.startsAt}` : ''}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-dim">Lead contacted</dt>
                <dd>{preview.contactedAt || 'Not contacted'}</dd>
              </div>
            </dl>
          ) : null}
        </section>
      ) : null}

      {canOperate ? (
        <details className="rounded-xl border border-brand-border bg-white p-4 sm:p-5">
          <summary className="text-sm font-bold text-brand-text cursor-pointer">Admin settings</summary>
          <div className="mt-4 space-y-4">
            <p className="text-xs text-brand-muted">
              Saving a mailing address invalidates template approval. Changing only the daily cap
              does not. Client checkboxes cannot mark schema, sender, history, or opt-out as verified.
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
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-brand-dim">Daily send cap</span>
              <input
                className="mt-1 w-full sm:w-40 rounded-lg border border-brand-border px-3 py-2 text-sm"
                type="number"
                min={0}
                max={200}
                value={dailyCap}
                onChange={(event) => setDailyCap(event.target.value)}
              />
            </label>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void post('update-settings', {
                  physicalMailingAddress: address,
                  dailySendLimit: Number(dailyCap),
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
