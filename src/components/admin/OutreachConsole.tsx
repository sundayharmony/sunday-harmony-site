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
  acceptedAt: string | null
  contactedAt: string | null
  subject: string
  previewText: string
  previewHtml?: string
  attachment: string
  handoff: {
    phone: string | null
    booking: { status: string; startsAt: string | null }
    customMessage: string
  } | null
}

type ConsolePayload = {
  disabled: boolean
  liveSend?: boolean
  storage: string
  senderConfigured: boolean
  canOperate?: boolean
  attachmentPresent?: boolean
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
  audit: Array<{ id: string; action: string; createdAt: string }>
  provider: { intended: string; idempotencyRecovery: boolean; note: string }
  scheduler?: { enabled: boolean; note: string }
  error?: string
}

export default function OutreachConsole() {
  const [data, setData] = useState<ConsolePayload | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [address, setAddress] = useState('')
  const [dailyCap, setDailyCap] = useState('0')

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

  async function post(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action)
    setError('')
    try {
      const response = await fetch('/api/admin/outreach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok && payload.error) setError(payload.error)
      await load()
    } finally {
      setBusy('')
    }
  }

  if (!data) {
    return <p className="text-sm text-brand-muted">{error || 'Loading outreach review…'}</p>
  }

  const selected = data.queue.find((row) => row.id === openId) || data.queue[0] || null
  const canOperate = Boolean(data.canOperate)

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-brand-dim">Sales review</p>
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mt-1">Prospect outreach</h1>
        <p className="text-sm text-brand-muted mt-2 max-w-2xl">
          {data.liveSend
            ? 'Live weekday send is on. The production cron sends up to the daily cap from the pending queue. Kill switch and gates still fail closed.'
            : 'Disabled automation. Queue and previews only. Live Gmail send stays off until every server-side gate is satisfied. Templates remain unapproved until you explicitly approve them.'}
        </p>
      </div>

      <div className="rounded-xl border border-brand-border bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <StatusBadge status={data.liveSend ? 'active' : 'paused'} />
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-dim">
            {data.settings.killSwitch
              ? 'Kill switch on'
              : data.liveSend
                ? 'Kill switch off'
                : 'Kill switch off (still gated)'}
          </span>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-brand-dim text-xs uppercase tracking-wide">Sender</dt>
            <dd className="text-brand-text">{data.settings.senderEmail}</dd>
          </div>
          <div>
            <dt className="text-brand-dim text-xs uppercase tracking-wide">Signer</dt>
            <dd className="text-brand-text">{data.settings.signerName}, {data.settings.companyName}</dd>
          </div>
          <div>
            <dt className="text-brand-dim text-xs uppercase tracking-wide">CTA</dt>
            <dd className="text-brand-text">{data.settings.ctaUrl}</dd>
          </div>
          <div>
            <dt className="text-brand-dim text-xs uppercase tracking-wide">Mailing address</dt>
            <dd className="text-brand-text">{data.settings.physicalMailingAddress || 'Missing (activation blocked)'}</dd>
          </div>
          <div>
            <dt className="text-brand-dim text-xs uppercase tracking-wide">Template</dt>
            <dd className="text-brand-text">{data.template?.approved ? 'Approved' : 'Unapproved draft'}</dd>
          </div>
          <div>
            <dt className="text-brand-dim text-xs uppercase tracking-wide">History</dt>
            <dd className="text-brand-text">{data.settings.historyReconciliationStatus}</dd>
          </div>
          <div>
            <dt className="text-brand-dim text-xs uppercase tracking-wide">Opt-out verified</dt>
            <dd className="text-brand-text">{data.settings.optOutVerifiedAt || 'Not verified'}</dd>
          </div>
          <div>
            <dt className="text-brand-dim text-xs uppercase tracking-wide">Settings version</dt>
            <dd className="text-brand-text">{data.settings.settingsVersion ?? 1}</dd>
          </div>
        </dl>
        <p className="text-xs text-brand-muted mt-3">{data.provider.note}</p>
        {data.scheduler ? <p className="text-xs text-brand-muted mt-2">{data.scheduler.note}</p> : null}
      </div>

      <section className="rounded-xl border border-brand-border bg-white p-4 sm:p-5">
        <h2 className="text-sm font-bold text-brand-text mb-3">Activation blockers</h2>
        <ul className="space-y-2">
          {data.blockers.map((blocker) => (
            <li key={blocker.code} className="text-sm text-brand-text border border-brand-border rounded-lg px-3 py-2">
              <span className="font-semibold">{blocker.code}</span>
              <span className="block text-brand-muted text-xs mt-1">{blocker.message}</span>
            </li>
          ))}
        </ul>
      </section>

      {canOperate ? (
        <section className="rounded-xl border border-brand-border bg-white p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-bold text-brand-text">Operator settings</h2>
          <p className="text-xs text-brand-muted">
            Saving a mailing address invalidates template approval. Changing only the daily cap
            does not. Client checkboxes cannot mark schema, sender, history, or opt-out as verified.
          </p>
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
        </section>
      ) : null}

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
          <>
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
          </>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}

      <section className="rounded-xl border border-brand-border bg-white overflow-hidden">
        <header className="px-4 py-3 border-b border-brand-border bg-neutral-50">
          <h2 className="text-sm font-bold text-brand-text">Queue</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim">
                <th className="px-4 py-2">Business</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Delivery</th>
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
                    <td className="px-4 py-3">{row.deliveryState}</td>
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
          <p className="text-sm text-brand-text font-medium">{selected.subject}</p>
          <pre className="whitespace-pre-wrap text-sm text-brand-muted bg-neutral-50 border border-brand-border rounded-lg p-3">
            {selected.previewText}
          </pre>
          <p className="text-xs text-brand-dim">Attachment: {selected.attachment}</p>
          {selected.handoff ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-dim">Phone on file</dt>
                <dd>{selected.handoff.phone || 'None stored'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-dim">Booking</dt>
                <dd>{selected.handoff.booking.status}{selected.handoff.booking.startsAt ? ` · ${selected.handoff.booking.startsAt}` : ''}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-dim">Accepted</dt>
                <dd>{selected.acceptedAt || 'Not accepted'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-dim">Contacted</dt>
                <dd>{selected.contactedAt || 'Not contacted'}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-xs text-brand-muted">Handoff fields are limited for this role.</p>
          )}
        </section>
      ) : null}

      <section className="rounded-xl border border-brand-border bg-white p-4 sm:p-5">
        <h2 className="text-sm font-bold text-brand-text mb-3">Unverified historical reports</h2>
        <p className="text-xs text-brand-muted mb-3">
          Email Bot assertions. Not provider-confirmed. They block review and must not duplicate sends.
          Live lead records are not mutated from this list. Reconciliation requires Gmail message ids.
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
      </section>

      <section className="rounded-xl border border-brand-border bg-white p-4 sm:p-5">
        <h2 className="text-sm font-bold text-brand-text mb-3">Audit</h2>
        {data.audit.length === 0 ? (
          <p className="text-sm text-brand-muted">No outreach audit events yet.</p>
        ) : (
          <ul className="space-y-1 text-xs text-brand-muted">
            {data.audit.map((event) => (
              <li key={event.id}>
                {event.createdAt} · {event.action}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
