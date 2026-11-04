'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ReferrerPayoutForm from '@/components/admin/ReferrerPayoutForm'
import StatCard from '@/components/ui/StatCard'
import { creditReferralStatusLabel, formatCommissionCents } from '@/lib/referrals'

type OverviewClient = {
  clientId: string
  name: string
  email: string
  code: string
  status: string
  availableCents: number
  payoutReady?: boolean
  hasConnectAccount?: boolean
  payoutSetup?: string | null
}

type CreditReferralRow = {
  referralId: string
  referrerClientId: string
  referrerName: string
  code: string | null
  referredName: string
  status: string
  paid: boolean
  paidAt: string | null
  amountCents: number | null
  canMarkPaid: boolean
  commissionId: string | null
}

type PayoutHistoryRow = {
  id: string
  date: string
  amountCents: number
  status: string
  paymentReference: string | null
  failureReason: string | null
  clientId: string
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
  creditReferrals?: CreditReferralRow[]
  payouts?: PayoutHistoryRow[]
}

type ReferrerCard = {
  clientId: string
  name: string
  email: string
  code: string | null
  payoutSetup: string | null
}

function formatPaidOn(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Paid'
  const formatted = date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  return `Paid ${formatted} ET`
}

function referrerCards(data: OverviewPayload): ReferrerCard[] {
  const clients = new Map(data.clients.map((client) => [client.clientId, client]))
  const seen = new Set<string>()
  const cards: ReferrerCard[] = []
  for (const row of data.creditReferrals || []) {
    if (!row.referrerClientId || seen.has(row.referrerClientId)) continue
    seen.add(row.referrerClientId)
    const client = clients.get(row.referrerClientId)
    cards.push({
      clientId: row.referrerClientId,
      name: client?.name || row.referrerName,
      email: client?.email || '',
      code: client?.code || row.code,
      payoutSetup: client?.payoutSetup || null,
    })
  }
  cards.sort((a, b) => a.name.localeCompare(b.name) || a.clientId.localeCompare(b.clientId))
  return cards
}

function latestPayout(payouts: PayoutHistoryRow[] | undefined, clientId: string): PayoutHistoryRow | null {
  return (payouts || []).find((payout) => payout.clientId === clientId) || null
}

function payoutLine(row: CreditReferralRow): string {
  const paid = row.paid ? (row.paidAt ? formatPaidOn(row.paidAt) : 'Paid') : 'Not paid'
  if (row.amountCents == null) return paid
  return `${paid} · ${formatCommissionCents(row.amountCents)}`
}

export default function AdminReferralsPage() {
  const [data, setData] = useState<OverviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/referrals')
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload.error || 'Failed to load')
    setData(payload)
  }, [])

  useEffect(() => {
    void load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load referrals'))
      .finally(() => setLoading(false))
  }, [load])

  const rows = data?.creditReferrals || []
  const referrers = useMemo(() => (data ? referrerCards(data) : []), [data])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      [row.referrerName, row.code || '', row.referredName, creditReferralStatusLabel(row.status), row.paid ? 'paid' : 'not paid']
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [rows, query])

  const markPaid = async (row: CreditReferralRow) => {
    if (!row.commissionId || !row.canMarkPaid) return
    setBusyId(row.referralId)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/admin/referrals/${encodeURIComponent(row.referrerClientId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_paid', commissionId: row.commissionId }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Could not mark this referral paid')
      setNotice(payload.message || 'Marked paid.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark this referral paid')
    } finally {
      setBusyId('')
    }
  }

  if (loading) return <p className="text-sm text-brand-dim">Loading referral payouts…</p>

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Referrals</h1>
        <p className="text-sm text-brand-muted max-w-2xl">
          Clients who referred someone to credit repair. Enter an amount and choose Send payout to pay that referrer through Stripe. Mark paid only records a payment you already made yourself. It does not send money.
        </p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {notice && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">{notice}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Referral clients" value={data?.overview.referralClients ?? 0} />
        <StatCard label="Applications" value={data?.overview.submitted ?? 0} />
        <StatCard label="Outstanding" value={formatCommissionCents(data?.overview.outstandingCents || 0)} />
        <StatCard label="Commissions paid" value={formatCommissionCents(data?.overview.paidCents || 0)} />
      </div>

      {referrers.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-bold text-brand-text">Send payout</h2>
          <ul className="space-y-3">
            {referrers.map((referrer) => {
              const latest = latestPayout(data?.payouts, referrer.clientId)
              return (
                <li key={referrer.clientId} className="rounded-xl border border-brand-border bg-white p-4 sm:p-5">
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-text break-words">{referrer.name}</p>
                    <p className="mt-0.5 text-sm text-brand-muted break-words">
                      {referrer.email || 'No email'}
                      {referrer.code ? ` · ${referrer.code}` : ''}
                    </p>
                    {latest ? (
                      <p className="mt-2 text-sm text-brand-text break-words">
                        Last payout: {latest.status === 'paid' ? 'Paid' : latest.status} {formatCommissionCents(latest.amountCents)}
                        {latest.paymentReference ? ` · ${latest.paymentReference}` : ''}
                        {latest.status !== 'paid' && latest.failureReason ? ` · ${latest.failureReason}` : ''}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-brand-dim">No Stripe payout sent yet.</p>
                    )}
                  </div>
                  <ReferrerPayoutForm
                    clientId={referrer.clientId}
                    setupMessage={referrer.payoutSetup}
                    onComplete={load}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <div className="bg-white border border-brand-border rounded-xl p-8 text-center">
          <p className="font-semibold text-brand-text">No one has referred a credit client yet</p>
          <p className="text-sm text-brand-muted mt-2 max-w-md mx-auto">
            When a credit repair client sends someone to credit and funding, that referral shows up here with its payout status.
          </p>
        </div>
      ) : (
        <div>
          <label className="block mb-4">
            <span className="sr-only">Search referrals</span>
            <input
              className="w-full py-2.5 px-3 bg-white border border-brand-border rounded-lg text-sm"
              placeholder="Search referrer, code, or referred client"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {filtered.length === 0 ? (
            <p className="text-sm text-brand-dim bg-white border border-brand-border rounded-xl p-6 text-center">
              No referrals match this search.
            </p>
          ) : (
            <ul className="space-y-3">
              {filtered.map((row) => (
                <li key={row.referralId} className="bg-white border border-brand-border rounded-xl p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <dl className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                      <div className="min-w-0">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-dim">Referrer</dt>
                        <dd className="mt-0.5 font-semibold text-brand-text break-words">
                          <Link
                            href={`/admin/referrals/${encodeURIComponent(row.referrerClientId)}`}
                            className="text-accent hover:underline"
                          >
                            {row.referrerName}
                          </Link>
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-dim">Code</dt>
                        <dd className="mt-0.5 font-mono text-xs break-all text-brand-text">{row.code || '—'}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-dim">Referred client</dt>
                        <dd className="mt-0.5 text-brand-text break-words">{row.referredName}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-dim">Status</dt>
                        <dd className="mt-0.5 capitalize text-brand-text">{creditReferralStatusLabel(row.status)}</dd>
                      </div>
                      <div className="min-w-0 sm:col-span-2">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-dim">Payout</dt>
                        <dd className="mt-0.5 text-brand-text break-words">{payoutLine(row)}</dd>
                      </div>
                    </dl>
                    {row.canMarkPaid ? (
                      <button
                        type="button"
                        disabled={busyId === row.referralId}
                        onClick={() => void markPaid(row)}
                        className="w-full sm:w-auto shrink-0 px-4 py-2.5 text-sm font-semibold bg-brand-text text-white rounded-lg disabled:opacity-50"
                      >
                        {busyId === row.referralId ? 'Saving…' : 'Mark paid'}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
