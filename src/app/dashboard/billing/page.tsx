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

interface Invoice {
  id: string
  date: string
  amount: number
  status: 'paid' | 'current' | 'overdue'
  desc: string
}

const tierLabels: Record<string, string> = {
  social_essentials: 'Social Essentials',
  spark: 'Spark',
  growth: 'Growth',
  scale: 'Scale',
}

const statusStyles: Record<string, { color: string; bg: string; label: string }> = {
  paid: { color: '#2d8a62', bg: '#f0fdf4', label: 'Paid' },
  current: { color: '#2e7bb5', bg: '#eff6ff', label: 'Current' },
  overdue: { color: '#c94a42', bg: '#fef2f2', label: 'Overdue' },
}

function generateInvoices(startDate: string, monthlyPrice: number): Invoice[] {
  const startTime = startDate ? new Date(startDate).getTime() : new Date().getTime()
  const start = new Date(startTime)
  const now = new Date()
  const invoices: Invoice[] = []

  // Generate one invoice per month from start_date to now
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  let counter = 1

  while (cursor <= currentMonth) {
    const isCurrentMonth = cursor.getFullYear() === currentMonth.getFullYear() && cursor.getMonth() === currentMonth.getMonth()
    const monthName = cursor.toLocaleDateString ? cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A'

    invoices.push({
      id: `INV-${String(counter).padStart(3, '0')}`,
      date: cursor.toISOString().split('T')[0],
      amount: monthlyPrice,
      status: isCurrentMonth ? 'current' : 'paid',
      desc: monthName,
    })

    cursor.setMonth(cursor.getMonth() + 1)
    counter++
  }

  // Return newest first
  return invoices.reverse()
}

function getNextInvoiceDate(invoices: Invoice[]): string {
  if (invoices.length === 0) return '—'
  // The most recent invoice is the current month; next invoice is the following month
  const latest = new Date(invoices[0].date)
  latest.setMonth(latest.getMonth() + 1)
  return latest.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function BillingPage() {
  const [client, setClient] = useState<ClientData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/dashboard/profile', { signal: controller.signal })
        if (res.ok) {
          const data = await res.json()
          if (data && data.start_date) {
            setClient(data)
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Failed to fetch profile', err)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
    return () => controller.abort()
  }, [])

  const monthlyPrice = client?.monthly_price || 0
  const invoices = client ? generateInvoices(client.start_date, monthlyPrice) : []
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)
  const nextInvoice = getNextInvoiceDate(invoices)

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
            <div className="text-sm text-brand-text font-semibold">{nextInvoice}</div>
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

        {invoices.length > 0 ? (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-5 gap-4 px-3 py-2 text-[10px] font-bold uppercase text-brand-dim">
              <span>Invoice</span>
              <span>Period</span>
              <span>Date</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            {invoices.map((inv) => {
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
        ) : (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🧾</div>
            <p className="text-sm text-brand-muted">No invoices yet.</p>
            <p className="text-xs text-brand-dim mt-1">Invoices will appear here once your plan is active.</p>
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="mt-6 bg-[rgba(184,148,63,0.08)] border border-brand-gold rounded-xl p-4 text-center">
        <p className="text-sm text-brand-muted">
          Questions about billing?{' '}
          <a href="/dashboard/messages" className="text-brand-gold hover:underl