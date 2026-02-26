'use client'

import { useState, useEffect } from 'react'
import StatCard from '@/components/ui/StatCard'

interface ClientData {
  id: string
  name: string
  business: string
  package_tier: string
  monthly_price: number
  start_date: string
  status: string
}

const tierLabels: Record<string, string> = {
  social_essentials: 'Social Essentials',
  spark: 'Spark',
  growth: 'Growth',
  scale: 'Scale',
}

// Simulated invoices — in production, pull from Stripe or QuickBooks
const invoices = [
  { id: 'INV-006', date: '2026-02-01', amount: 0, status: 'current', desc: 'February 2026' },
  { id: 'INV-005', date: '2026-01-01', amount: 0, status: 'paid', desc: 'January 2026' },
  { id: 'INV-004', date: '2025-12-01', amount: 0, status: 'paid', desc: 'December 2025' },
  { id: 'INV-003', date: '2025-11-01', amount: 0, status: 'paid', desc: 'November 2025' },
  { id: 'INV-002', date: '2025-10-01', amount: 0, status: 'paid', desc: 'October 2025' },
  { id: 'INV-001', date: '2025-09-01', amount: 0, status: 'paid', desc: 'September 2025' },
]

const statusStyles: Record<string, { color: string; bg: string; label: string }> = {
  paid: { color: '#2d8a62', bg: '#f0fdf4', label: 'Paid' },
  current: { color: '#2e7bb5', bg: '#eff6ff', label: 'Current' },
  overdue: { color: '#c94a42', bg: '#fef2f2', label: 'Overdue' },
}

export default function BillingPage() {
  const [client, setClient] = useState<ClientData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/profile')
      .then(res => res.ok ? res.json() : null)
      .then(data => { setClient(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const monthlyPrice = client?.monthly_price || 0
  const populatedInvoices = invoices.map(inv => ({ ...inv, amount: monthlyPrice }))
  const totalPaid = populatedInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-brand-muted text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Billing</h1>
        <p className="text-sm text-brand-muted">View your plan, invoices, and payment history.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Current Plan"
          value={client ? tierLabels[client.package_tier] || client.package_tier : '—'}
          color="#c9a96e"
        />
        <StatCard
          label="Monthly Rate"
          value={`$${monthlyPrice.toLocaleString()}`}
          color="#4a9e7d"
        />
        <StatCard
          label="Total Paid"
          value={`$${totalPaid.toLocaleString()}`}
          color="#3a8bc2"
        />
        <StatCard
          label="Account Status"
          value={client?.status === 'active' ? 'Active' : client?.status || '—'}
          color={client?.status === 'active' ? '#4a9e7d' : '#d4564e'}
        />
      </div>

      {/* Plan Details */}
      <div className="bg-white border border-brand-border rounded-2xl p-6 mb-6">
        <h2 className="text-base font-bold text-brand-text mb-4">Plan Details</h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-[10px] font-bold uppercase text-brand-dim mb-1">Package</div>
            <div className="text-sm text-brand-text font-semibold">
              {client ? tierLabels[client.package_tier] || client.package_tier : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-brand-dim mb-1">Billing Cycle</div>
            <div className="text-sm text-brand-text font-semibold">Monthly</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-brand-dim mb-1">Next Invoice</div>
            <div className="text-sm text-brand-text font-semibold">March 1, 2026</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-brand-dim mb-1">Member Since</div>
            <div className="text-sm text-brand-text font-semibold">
              {client?.start_date ? new Date(client.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-brand-dim mb-1">Payment Method</div>
            <div className="text-sm text-brand-text font-semibold">Contact us to set up</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-brand-dim mb-1">Annual Value</div>
            <div className="text-sm text-brand-gold font-semibold">${(monthlyPrice * 12).toLocaleString()}/yr</div>
          </div>
        </div>
      </div>

      {/* Invoice History */}
      <div className="bg-white border border-brand-border rounded-2xl p-6">
        <h2 className="text-base font-bold text-brand-text mb-4">Invoice History</h2>
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-5 gap-4 px-3 py-2 text-[10px] font-bold uppercase text-brand-dim">
            <span>Invoice</span>
            <span>Period</span>
            <span>Date</span>
            <span>Amount</span>
            <span>Status</span>
          </div>
          {populatedInvoices.map((inv) => {
            const style = statusStyles[inv.status] || statusStyles.paid
            return (
              <div
                key={inv.id}
                className="grid grid-cols-5 gap-4 px-3 py-3 rounded-lg bg-gray-50 border border-brand-border items-center"
              >
                <span className="text-sm text-brand-text font-semibold">{inv.id}</span>
                <span className="text-sm text-brand-muted">{inv.desc}</span>
                <span className="text-sm text-brand-muted">
                  {new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-sm text-brand-text font-semibold">${inv.amount.toLocaleString()}</span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block w-fit"
                  style={{ color: style.color, background: style.bg }}
                >
                  {style.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Questions */}
      <div className="mt-6 bg-[rgba(184,148,63,0.08)] border border-brand-gold rounded-xl p-4 text-center">
        <p className="text-sm text-brand-muted">
          Questions about billing?{' '}
          <a href="/dashboard/messages" className="text-brand-gold hover:underline font-semibold">
            Send us a message
          </a>{' '}
          or email{' '}
          <a href="mailto:sales@sundayharmony.com" className="text-brand-gold hover:underline font-semibold">
            sales@sundayharmony.com
          </a>
        </p>
      </div>
    </div>
  )
}
