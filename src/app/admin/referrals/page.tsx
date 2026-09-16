'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import StatCard from '@/components/ui/StatCard'
import { formatCommissionCents } from '@/lib/referrals'

type OverviewClient = {
  clientId: string
  name: string
  email: string
  code: string
  status: string
  payoutReady: boolean
  clicks: number
  submitted: number
  paidApplicants: number
  earnedCents: number
  paidCents: number
  pendingCents: number
  availableCents: number
}

type PayoutRow = {
  id: string
  date: string
  amountCents: number
  status: string
  paymentReference: string | null
  provider: string
  failureReason: string | null
  clientId: string
  clientName: string
  clientEmail: string
}

type OverviewPayload = {
  overview: {
    referralClients: number
    clicks: number
    submitted: number
    paidApplicants: number
    earnedCents: number
    paidCents: number
    outstandingCents: number
    pendingPayouts: number
  }
  clients: OverviewClient[]
  payouts: PayoutRow[]
}

export default function AdminReferralsPage() {
  const [data, setData] = useState<OverviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'clients' | 'payouts'>('clients')

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/referrals')
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload.error || 'Failed to load')
        setData(payload)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load referrals')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    const rows = data?.clients || []
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(row =>
      [row.name, row.email, row.code, String(row.submitted), String(row.earnedCents), String(row.paidCents), String(row.availableCents), row.status]
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [data, query])

  if (loading) return <p className="text-sm text-brand-dim">Loading referral management…</p>

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Referral Management</h1>
        <p className="text-sm text-brand-muted">
          Track referral links, qualifying credit repair payments, commissions, and payouts.
        </p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Referral clients" value={data?.overview.referralClients ?? 0} />
        <StatCard label="Referral clicks" value={data?.overview.clicks ?? 0} />
        <StatCard label="Applications generated" value={data?.overview.submitted ?? 0} />
        <StatCard label="Paid applicants" value={data?.overview.paidApplicants ?? 0} />
        <StatCard label="Commissions earned" value={formatCommissionCents(data?.overview.earnedCents || 0)} color="gold" />
        <StatCard label="Commissions paid" value={formatCommissionCents(data?.overview.paidCents || 0)} />
        <StatCard label="Outstanding" value={formatCommissionCents(data?.overview.outstandingCents || 0)} />
        <StatCard label="Pending payouts" value={data?.overview.pendingPayouts ?? 0} />
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab('clients')}
          className={`px-3 py-2 text-sm font-semibold rounded-lg border ${tab === 'clients' ? 'bg-brand-text text-white border-brand-text' : 'border-brand-border'}`}
        >
          Referral clients
        </button>
        <button
          type="button"
          onClick={() => setTab('payouts')}
          className={`px-3 py-2 text-sm font-semibold rounded-lg border ${tab === 'payouts' ? 'bg-brand-text text-white border-brand-text' : 'border-brand-border'}`}
        >
          Referral payouts
        </button>
      </div>

      {tab === 'clients' ? (
        <div className="bg-white border border-brand-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-brand-border">
            <input
              className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm"
              placeholder="Search name, email, code, commissions, payout status…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-brand-dim">
                <tr>
                  {['Client', 'Code', 'Referrals', 'Earned', 'Paid', 'Available', 'Payout'].map(h => (
                    <th key={h} className="text-left p-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-brand-dim">No referral clients match this search.</td>
                  </tr>
                ) : (
                  filtered.map(row => (
                    <tr key={row.clientId} className="border-t border-brand-border">
                      <td className="p-3">
                        <Link href={`/admin/referrals/${row.clientId}`} className="font-semibold text-accent hover:underline">
                          {row.name}
                        </Link>
                        <div className="text-xs text-brand-dim">{row.email}</div>
                      </td>
                      <td className="p-3 font-mono text-xs">{row.code}</td>
                      <td className="p-3">{row.submitted} submitted / {row.clicks} clicks</td>
                      <td className="p-3">{formatCommissionCents(row.earnedCents)}</td>
                      <td className="p-3">{formatCommissionCents(row.paidCents)}</td>
                      <td className="p-3">{formatCommissionCents(row.availableCents)}</td>
                      <td className="p-3 capitalize">{row.payoutReady ? 'Ready' : row.status === 'disabled' ? 'Disabled' : 'Not set up'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-brand-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-brand-dim">
                <tr>
                  {['Date', 'Client', 'Amount', 'Status', 'Provider', 'Reference'].map(h => (
                    <th key={h} className="text-left p-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.payouts || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-brand-dim">No payouts yet.</td>
                  </tr>
                ) : (
                  (data?.payouts || []).map(row => (
                    <tr key={row.id} className="border-t border-brand-border">
                      <td className="p-3">{new Date(row.date).toLocaleDateString()}</td>
                      <td className="p-3">
                        <Link href={`/admin/referrals/${row.clientId}`} className="font-semibold text-accent hover:underline">
                          {row.clientName}
                        </Link>
                        <div className="text-xs text-brand-dim">{row.clientEmail}</div>
                      </td>
                      <td className="p-3">{formatCommissionCents(row.amountCents)}</td>
                      <td className="p-3 capitalize">
                        {row.status}
                        {row.failureReason ? <div className="text-xs text-brand-red">{row.failureReason}</div> : null}
                      </td>
                      <td className="p-3 capitalize">{row.provider}</td>
                      <td className="p-3 font-mono text-xs">{row.paymentReference || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
