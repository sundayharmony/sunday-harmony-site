'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { computeBillingMetrics } from '@/lib/billing-metrics'
import { TIER_LABELS } from '@/lib/stripe-catalog'

interface ClientRow {
  id: string
  name: string
  business: string
  package_tier: string
  monthly_price: number
  status: string
  is_potential?: boolean
  billing_status?: string
  stripe_subscription_id?: string
  stripe_customer_id?: string
  next_billing_date?: string
}

const billingBadge = (status?: string) => {
  const s = status || 'not_started'
  const map: Record<string, string> = {
    paid: 'bg-green-50 text-green-800 border-green-200',
    trial: 'bg-blue-50 text-blue-800 border-blue-200',
    past_due: 'bg-red-50 text-red-800 border-red-200',
    unpaid: 'bg-amber-50 text-amber-900 border-amber-200',
    not_started: 'bg-gray-50 text-brand-dim border-brand-border',
  }
  return map[s] || map.not_started
}

export default function AdminBillingPage() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'at_risk' | 'potential' | 'paying'>('all')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/clients')
        if (!res.ok) throw new Error('load failed')
        const data = await res.json()
        setClients(Array.isArray(data) ? data : [])
      } catch {
        setClients([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const metrics = useMemo(() => computeBillingMetrics(clients), [clients])

  const filtered = useMemo(() => {
    if (filter === 'at_risk') {
      return clients.filter(c => c.billing_status === 'past_due' || c.billing_status === 'unpaid')
    }
    if (filter === 'potential') return clients.filter(c => c.is_potential)
    if (filter === 'paying') {
      return clients.filter(
        c =>
          !c.is_potential &&
          c.stripe_subscription_id?.trim() &&
          (c.billing_status === 'paid' || c.billing_status === 'trial')
      )
    }
    return clients
  }, [clients, filter])

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Billing</h1>
        <p className="text-sm text-brand-muted">
          All subscription management happens in-app. Contracted MRR is plan on file; Stripe MRR is active subscribed clients.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-brand-border rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase text-brand-dim mb-1">Contracted MRR</div>
          <div className="font-serif text-2xl font-extrabold text-brand-text">
            ${metrics.contractedMrr.toLocaleString()}
          </div>
        </div>
        <div className="bg-accent-soft border border-accent rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase text-accent mb-1">Stripe MRR (est.)</div>
          <div className="font-serif text-2xl font-extrabold text-brand-text">
            ${metrics.stripeMrr.toLocaleString()}
          </div>
        </div>
        <div className="bg-white border border-brand-border rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase text-brand-dim mb-1">Paying (Stripe)</div>
          <div className="font-serif text-2xl font-extrabold text-brand-text">{metrics.activePayingCount}</div>
        </div>
        <div className="bg-white border border-brand-border rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase text-brand-dim mb-1">At risk</div>
          <div className="font-serif text-2xl font-extrabold text-red-700">{metrics.atRiskCount}</div>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'paying', 'at_risk', 'potential'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              filter === f
                ? 'bg-accent-soft text-accent border-accent'
                : 'bg-white text-brand-dim border-brand-border'
            }`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="bg-white border border-brand-border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-brand-dim text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-brand-dim text-sm">No clients match this filter.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-left text-[10px] font-bold uppercase text-brand-dim">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">$/mo</th>
                <th className="px-4 py-3">Billing</th>
                <th className="px-4 py-3">Next bill</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-brand-text">{c.name}</div>
                    <div className="text-xs text-brand-muted">{c.business}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {TIER_LABELS[c.package_tier as keyof typeof TIER_LABELS] || c.package_tier}
                    {c.is_potential && (
                      <span className="ml-1 text-[10px] text-amber-700">(potential)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">${(c.monthly_price || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${billingBadge(c.billing_status)}`}
                    >
                      {c.billing_status || 'not_started'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-dim">
                    {c.next_billing_date
                      ? new Date(c.next_billing_date).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/clients?client=${c.id}`}
                      className="text-xs text-accent font-semibold hover:underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
