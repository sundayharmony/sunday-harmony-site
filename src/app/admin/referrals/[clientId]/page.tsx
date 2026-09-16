'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { formatCommissionCents, publicCommissionLabel } from '@/lib/referrals'

type DetailPayload = {
  client: { id: string; name: string; email: string; billing_status: string } | null
  profile: {
    code: string
    link: string
    status: string
    payoutReady: boolean
    hasConnectAccount: boolean
  }
  summary: {
    clicks: number
    submitted: number
    paidApplicants: number
    earnedCents: number
    paidCents: number
    pendingCents: number
    availableCents: number
  }
  referrals: Array<{
    id: string
    commissionId: string | null
    date: string
    applicant: string
    applicationStatus: string
    applicationId: string | null
    applicationUuid: string | null
    payment: string
    commissionCents: number
    commissionStatus: string
  }>
  payouts: Array<{
    id: string
    date: string
    amountCents: number
    status: string
    paymentReference: string | null
    provider: string
    failureReason: string | null
  }>
  events: Array<{ id: string; type: string; detail: string | null; createdAt: string }>
}

export default function AdminReferralClientPage() {
  const params = useParams<{ clientId: string }>()
  const clientId = params.clientId
  const [data, setData] = useState<DetailPayload | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [manualReference, setManualReference] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/referrals/${encodeURIComponent(clientId)}`)
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload.error || 'Failed to load')
    setData(payload)
  }, [clientId])

  useEffect(() => {
    void load().catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [load])

  const post = async (body: Record<string, unknown>) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/admin/referrals/${encodeURIComponent(clientId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Update failed')
      setNotice(payload.message || 'Saved.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  if (!data) {
    return <p className="text-sm text-brand-dim">{error || 'Loading referral client…'}</p>
  }

  return (
    <div>
      <Link href="/admin/referrals" className="text-xs font-semibold text-accent hover:underline">
        ← Referral management
      </Link>
      <h1 className="font-serif text-3xl font-extrabold text-brand-text mt-3 mb-1">
        {data.client?.name || 'Referral client'}
      </h1>
      <p className="text-sm text-brand-muted mb-6">{data.client?.email}</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {notice && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">{notice}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-brand-border rounded-xl p-5">
          <h2 className="text-sm font-bold mb-2">Referral link</h2>
          <p className="font-mono text-sm break-all">{data.profile.link}</p>
          <p className="text-xs text-brand-dim mt-2">Code {data.profile.code} · {data.profile.status}</p>
        </div>
        <div className="bg-white border border-brand-border rounded-xl p-5">
          <h2 className="text-sm font-bold mb-2">Payout profile</h2>
          <p className="text-sm text-brand-muted mb-3">
            {data.profile.payoutReady
              ? 'Stripe Connect account is ready for transfers.'
              : data.profile.hasConnectAccount
                ? 'Stripe Connect onboarding is incomplete.'
                : 'No tokenized payout account yet. You can still record a manual payout.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => post({ action: data.profile.status === 'active' ? 'disable' : 'enable' })}
              className="px-3 py-2 text-xs font-semibold border border-brand-border rounded-lg"
            >
              {data.profile.status === 'active' ? 'Disable referrals' : 'Enable referrals'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => post({ action: 'regenerate' })}
              className="px-3 py-2 text-xs font-semibold border border-brand-border rounded-lg"
            >
              Regenerate code
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
        <div className="bg-white border border-brand-border rounded-xl p-4">Clicks: {data.summary.clicks}</div>
        <div className="bg-white border border-brand-border rounded-xl p-4">Submitted: {data.summary.submitted}</div>
        <div className="bg-white border border-brand-border rounded-xl p-4">Paid applicants: {data.summary.paidApplicants}</div>
        <div className="bg-white border border-brand-border rounded-xl p-4">Earned: {formatCommissionCents(data.summary.earnedCents)}</div>
        <div className="bg-white border border-brand-border rounded-xl p-4">Paid: {formatCommissionCents(data.summary.paidCents)}</div>
        <div className="bg-white border border-brand-border rounded-xl p-4">Pending: {formatCommissionCents(data.summary.pendingCents)}</div>
        <div className="bg-white border border-brand-border rounded-xl p-4">Available: {formatCommissionCents(data.summary.availableCents)}</div>
      </div>

      <div className="bg-white border border-brand-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-bold mb-3">Initiate payout</h2>
        <p className="text-sm text-brand-muted mb-3">
          Pays available commissions through Stripe Connect when the client has a payout account. Failed payouts return commissions to available.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={busy || data.summary.availableCents < 1}
            onClick={() => post({ action: 'payout', provider: 'stripe' })}
            className="px-4 py-2 text-sm font-semibold bg-brand-text text-white rounded-lg disabled:opacity-50"
          >
            Pay available balance
          </button>
          <input
            className="flex-1 py-2 px-3 border border-brand-border rounded-lg text-sm"
            placeholder="Manual payment reference"
            value={manualReference}
            onChange={e => setManualReference(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || data.summary.availableCents < 1}
            onClick={() => post({ action: 'payout', provider: 'manual', manualReference })}
            className="px-4 py-2 text-sm font-semibold border border-brand-border rounded-lg disabled:opacity-50"
          >
            Record manual payout
          </button>
        </div>
      </div>

      <div className="bg-white border border-brand-border rounded-xl overflow-hidden mb-6">
        <div className="p-5 border-b border-brand-border">
          <h2 className="text-sm font-bold">Referred applicants</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-brand-dim">
            <tr>
              {['Date', 'Applicant', 'Application', 'Payment', 'Commission'].map(h => (
                <th key={h} className="text-left p-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.referrals.map(row => (
              <tr key={row.id} className="border-t border-brand-border">
                <td className="p-3">{new Date(row.date).toLocaleDateString()}</td>
                <td className="p-3">{row.applicant}</td>
                <td className="p-3">
                  {row.applicationUuid ? (
                    <Link href={`/admin/credit-funding?id=${row.applicationUuid}`} className="text-accent hover:underline">
                      {row.applicationId || row.applicationStatus}
                    </Link>
                  ) : (
                    row.applicationId || row.applicationStatus
                  )}
                </td>
                <td className="p-3 capitalize">{row.payment}</td>
                <td className="p-3">
                  {publicCommissionLabel(row.commissionStatus, row.commissionCents)}
                  <span className="block text-[11px] text-brand-dim capitalize">{row.commissionStatus.replace(/_/g, ' ')}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-brand-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-bold mb-3">Adjust commission</h2>
        <p className="text-xs text-brand-muted mb-3">Manual changes require a reason and are written to the activity log.</p>
        <input
          className="w-full py-2 px-3 border border-brand-border rounded-lg text-sm mb-3"
          placeholder="Reason for adjustment"
          value={adjustReason}
          onChange={e => setAdjustReason(e.target.value)}
        />
        <div className="space-y-2">
          {data.referrals
            .filter(row => row.commissionId && row.commissionCents > 0)
            .map(row => (
              <div key={`adj-${row.id}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-[140px]">{row.applicant}</span>
                <button
                  type="button"
                  disabled={busy || !adjustReason.trim()}
                  onClick={() =>
                    post({
                      action: 'adjust',
                      commissionId: row.commissionId,
                      status: 'revoked',
                      reason: adjustReason,
                    })
                  }
                  className="text-xs font-semibold text-brand-red"
                >
                  Revoke
                </button>
              </div>
            ))}
        </div>
      </div>

      <div className="bg-white border border-brand-border rounded-xl overflow-hidden mb-6">
        <div className="p-5 border-b border-brand-border">
          <h2 className="text-sm font-bold">Payout history</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-brand-dim">
            <tr>
              {['Date', 'Amount', 'Status', 'Reference'].map(h => (
                <th key={h} className="text-left p-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.payouts.map(row => (
              <tr key={row.id} className="border-t border-brand-border">
                <td className="p-3">{new Date(row.date).toLocaleDateString()}</td>
                <td className="p-3">{formatCommissionCents(row.amountCents)}</td>
                <td className="p-3 capitalize">{row.status}</td>
                <td className="p-3 font-mono text-xs">{row.paymentReference || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-brand-border rounded-xl p-5">
        <h2 className="text-sm font-bold mb-3">Activity</h2>
        <ul className="space-y-2 text-sm">
          {data.events.map(event => (
            <li key={event.id} className="text-brand-muted">
              <span className="font-medium text-brand-text">{event.type.replace(/_/g, ' ')}</span>
              {event.detail ? ` — ${event.detail}` : ''}
              <span className="block text-xs text-brand-dim">{new Date(event.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
