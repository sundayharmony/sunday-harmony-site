'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import StatCard from '@/components/ui/StatCard'
import { formatCommissionCents, publicCommissionLabel } from '@/lib/referrals'

type ReferralRow = {
  id: string
  date: string
  applicant: string
  applicationStatus: string
  payment: string
  commissionCents: number
  commissionStatus: string
}

type PayoutRow = {
  id: string
  date: string
  amountCents: number
  status: string
  paymentReference: string | null
  failureReason: string | null
}

type DashboardPayload = {
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
  referrals: ReferralRow[]
  payouts: PayoutRow[]
}

function statusLabel(value: string) {
  return value.replace(/_/g, ' ')
}

function ReferralsContent() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [connectBusy, setConnectBusy] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/dashboard/referrals')
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload.error || 'Unable to load referrals.')
        setData(null)
        return
      }
      setData(payload)
    } catch {
      setError('Unable to load referrals.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const connect = searchParams.get('connect')
    if (connect !== 'return' && connect !== 'refresh') return
    void (async () => {
      await fetch('/api/dashboard/referrals/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      })
      await load()
    })()
  }, [searchParams, load])

  const copyLink = async () => {
    if (!data?.profile.link) return
    try {
      await navigator.clipboard.writeText(data.profile.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const startConnect = async () => {
    setConnectBusy(true)
    setError('')
    try {
      const res = await fetch('/api/dashboard/referrals/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'onboard' }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload.url) {
        setError(payload.error || 'Unable to start payout setup.')
        return
      }
      window.location.href = payload.url
    } catch {
      setError('Unable to start payout setup.')
    } finally {
      setConnectBusy(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-brand-muted">Loading referrals…</p>
  }

  if (error && !data) {
    return (
      <div>
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Referrals</h1>
        <p className="text-sm text-brand-muted">{error}</p>
      </div>
    )
  }

  if (!data) return null

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Referrals</h1>
        <p className="text-sm text-brand-muted">
          Share your unique link. You earn $50 when someone you refer completes their credit repair payment.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white border border-brand-border rounded-xl p-5 mb-6">
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">Your referral link</div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            readOnly
            value={data.profile.link}
            className="flex-1 py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-sm text-brand-text"
          />
          <button
            type="button"
            onClick={copyLink}
            className="px-4 py-3 bg-brand-text text-white text-sm font-semibold rounded-[10px]"
          >
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        </div>
        <p className="text-xs text-brand-muted mt-2">
          Code {data.profile.code}
          {data.profile.status !== 'active' ? ' · Referrals are currently paused for this account' : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total referrals" value={data.summary.clicks} sub="Link clicks" />
        <StatCard label="Applications submitted" value={data.summary.submitted} />
        <StatCard label="Paid applicants" value={data.summary.paidApplicants} />
        <StatCard label="Total earned" value={formatCommissionCents(data.summary.earnedCents)} color="gold" />
        <StatCard label="Total paid" value={formatCommissionCents(data.summary.paidCents)} />
        <StatCard label="Pending" value={formatCommissionCents(data.summary.pendingCents)} />
        <StatCard label="Available for payout" value={formatCommissionCents(data.summary.availableCents)} color="green" />
      </div>

      <div className="bg-white border border-brand-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-bold text-brand-text mb-2">Payout method</h2>
        <p className="text-sm text-brand-muted mb-3">
          Connect a payout account through Stripe. Sunday Harmony never stores bank or debit credentials on this site.
        </p>
        <p className="text-xs text-brand-dim mb-3">
          {data.profile.payoutReady
            ? 'Payout account is ready.'
            : data.profile.hasConnectAccount
              ? 'Finish payout setup to receive commissions automatically.'
              : 'Set up payouts so commissions can be sent online.'}
        </p>
        <button
          type="button"
          disabled={connectBusy}
          onClick={startConnect}
          className="px-4 py-2 text-sm font-semibold border border-brand-border rounded-lg hover:bg-neutral-50 disabled:opacity-50"
        >
          {connectBusy ? 'Opening…' : data.profile.hasConnectAccount ? 'Continue payout setup' : 'Set up payouts'}
        </button>
      </div>

      <div className="bg-white border border-brand-border rounded-xl overflow-hidden mb-6">
        <div className="p-5 border-b border-brand-border">
          <h2 className="text-sm font-bold text-brand-text">Referral list</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-brand-dim">
              <tr>
                {['Date', 'Applicant', 'Application status', 'Payment', 'Commission'].map(h => (
                  <th key={h} className="text-left p-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.referrals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-brand-dim text-center">
                    No referred applications yet. Share your link to get started.
                  </td>
                </tr>
              ) : (
                data.referrals.map(row => (
                  <tr key={row.id} className="border-t border-brand-border">
                    <td className="p-3">{new Date(row.date).toLocaleDateString()}</td>
                    <td className="p-3">{row.applicant}</td>
                    <td className="p-3 capitalize">{statusLabel(row.applicationStatus)}</td>
                    <td className="p-3 capitalize">{row.payment}</td>
                    <td className="p-3">
                      {publicCommissionLabel(row.commissionStatus, row.commissionCents)}
                      {row.commissionStatus !== 'not_eligible' && row.commissionCents > 0 ? (
                        <span className="block text-[11px] text-brand-dim capitalize">
                          {statusLabel(row.commissionStatus)}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-brand-border rounded-xl overflow-hidden">
        <div className="p-5 border-b border-brand-border">
          <h2 className="text-sm font-bold text-brand-text">Payout history</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-brand-dim">
              <tr>
                {['Date', 'Amount', 'Status', 'Payment reference'].map(h => (
                  <th key={h} className="text-left p-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.payouts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-brand-dim text-center">No payouts yet.</td>
                </tr>
              ) : (
                data.payouts.map(row => (
                  <tr key={row.id} className="border-t border-brand-border">
                    <td className="p-3">{new Date(row.date).toLocaleDateString()}</td>
                    <td className="p-3">{formatCommissionCents(row.amountCents)}</td>
                    <td className="p-3 capitalize">{row.status}</td>
                    <td className="p-3 font-mono text-xs">
                      {row.paymentReference || '—'}
                      {row.failureReason ? (
                        <span className="block text-brand-red mt-1">{row.failureReason}</span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function ClientReferralsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-brand-muted">Loading referrals…</p>}>
      <ReferralsContent />
    </Suspense>
  )
}
