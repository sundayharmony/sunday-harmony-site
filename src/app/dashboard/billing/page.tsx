'use client'

import { useState, useEffect, useMemo } from 'react'
import StatCard from '@/components/ui/StatCard'

interface ClientData {
  id: string
  name: string
  business: string
  package_tier: string
  monthly_price: number
  start_date: string
  status: string
  billing_status?: string
  next_billing_date?: string | null
  last_payment_at?: string | null
  stripe_customer_id?: string
}

interface StripeInvoiceRow {
  id: string
  number: string | null
  status: string | null
  amount_paid: number
  amount_due: number
  currency: string
  hosted_invoice_url: string | null
  created: number
  period_start: number | null
  period_end: number | null
  paid_at: string | null
}

const tierLabels: Record<string, string> = {
  social_essentials: 'Social Essentials',
  spark: 'Spark',
  growth: 'Growth',
  scale: 'Scale',
}

const statusStyles: Record<string, { color: string; bg: string; label: string }> = {
  paid: { color: '#2d8a62', bg: '#f0fdf4', label: 'Paid' },
  current: { color: '#2e7bb5', bg: '#eff6ff', label: 'Open' },
  overdue: { color: '#c94a42', bg: '#fef2f2', label: 'Issue' },
}

function stripeInvoiceUiStatus(status: string | null): keyof typeof statusStyles {
  if (status === 'paid') return 'paid'
  if (status === 'open' || status === 'draft') return 'current'
  if (status === 'uncollectible' || status === 'void') return 'overdue'
  return 'current'
}

function formatMoneyCents(cents: number, currency: string): string {
  const cur = (currency || 'usd').toUpperCase()
  try {
    return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: cur })
  } catch {
    return `$${(cents / 100).toFixed(2)}`
  }
}

export default function BillingPage() {
  const [client, setClient] = useState<ClientData | null>(null)
  const [invoices, setInvoices] = useState<StripeInvoiceRow[]>([])
  const [invoiceNote, setInvoiceNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [profileRes, invRes] = await Promise.all([
          fetch('/api/dashboard/profile'),
          fetch('/api/dashboard/billing/invoices'),
        ])
        if (cancelled) return
        const profile = profileRes.ok ? await profileRes.json() : null
        setClient(profile)
        const invPayload = invRes.ok ? await invRes.json().catch(() => ({})) : {}
        setInvoices(Array.isArray(invPayload.invoices) ? invPayload.invoices : [])
        setInvoiceNote(typeof invPayload.message === 'string' ? invPayload.message : null)
      } catch {
        if (!cancelled) {
          setClient(null)
          setInvoices([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const monthlyPrice = client?.monthly_price || 0
  const totalPaid = useMemo(
    () => invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.amount_paid || 0), 0),
    [invoices]
  )

  const nextInvoiceLabel = useMemo(() => {
    if (client?.next_billing_date) {
      return new Date(client.next_billing_date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    }
    return '—'
  }, [client?.next_billing_date])

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
        <p className="text-sm text-brand-muted">Your plan on file and invoice history from Stripe.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Current Plan"
          value={client ? tierLabels[client.package_tier] || client.package_tier : '—'}
          color="accent"
        />
        <StatCard
          label="Monthly Rate (on file)"
          value={`$${monthlyPrice.toLocaleString()}`}
        />
        <StatCard
          label="Total Paid (Stripe)"
          value={formatMoneyCents(totalPaid, invoices[0]?.currency || 'usd')}
        />
        <StatCard
          label="Account Status"
          value={client?.status === 'active' ? 'Active' : client?.status || '—'}
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
            <div className="text-[10px] font-bold uppercase text-brand-dim mb-1">Next billing</div>
            <div className="text-sm text-brand-text font-semibold">{nextInvoiceLabel}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-brand-dim mb-1">Member Since</div>
            <div className="text-sm text-brand-text font-semibold">
              {client?.start_date ? new Date(client.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-brand-dim mb-1">Payment status</div>
            <div className="text-sm text-brand-text font-semibold">
              {client?.billing_status ? client.billing_status.replace('_', ' ') : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-brand-dim mb-1">Annual value (plan rate)</div>
            <div className="text-sm text-accent font-semibold">${(monthlyPrice * 12).toLocaleString()}/yr</div>
          </div>
        </div>
        {invoiceNote && (
          <p className="mt-4 text-xs text-brand-dim">{invoiceNote}</p>
        )}
      </div>

      {/* Invoice History */}
      <div className="bg-white border border-brand-border rounded-2xl p-6">
        <h2 className="text-base font-bold text-brand-text mb-4">Invoice History (Stripe)</h2>

        {invoices.length > 0 ? (
          <div className="space-y-2">
            <div className="grid grid-cols-5 gap-4 px-3 py-2 text-[10px] font-bold uppercase text-brand-dim">
              <span>Invoice</span>
              <span>Issued</span>
              <span>Amount</span>
              <span>Status</span>
              <span className="text-right">Receipt</span>
            </div>
            {invoices.map((inv) => {
              const uiKey = stripeInvoiceUiStatus(inv.status)
              const style = statusStyles[uiKey] || statusStyles.current
              const cents = inv.amount_paid > 0 ? inv.amount_paid : inv.amount_due
              const when = inv.created ? new Date(inv.created * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
              return (
                <div
                  key={inv.id}
                  className="grid grid-cols-5 gap-4 px-3 py-3 rounded-lg bg-gray-50 border border-brand-border items-center"
                >
                  <span className="text-xs font-mono font-semibold text-brand-text">{inv.number || inv.id}</span>
                  <span className="text-sm text-brand-muted">{when}</span>
                  <span className="text-sm text-brand-text font-semibold">{formatMoneyCents(cents, inv.currency)}</span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block w-fit capitalize"
                    style={{ color: style.color, background: style.bg }}
                  >
                    {inv.status || 'unknown'}
                  </span>
                  <span className="text-right text-sm">
                    {inv.hosted_invoice_url ? (
                      <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-accent font-semibold hover:underline">
                        View
                      </a>
                    ) : (
                      <span className="text-brand-dim">—</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🧾</div>
            <p className="text-sm text-brand-muted">No Stripe invoices to show yet.</p>
            <p className="text-xs text-brand-dim mt-1">
              {invoiceNote || 'Once billing is connected, your invoices will appear here.'}
            </p>
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="mt-6 bg-accent-soft border border-accent rounded-xl p-4 text-center">
        <p className="text-sm text-brand-muted">
          Questions about billing?{' '}
          <a href="/dashboard/messages" className="text-accent hover:underline font-semibold">
            Send us a message
          </a>{' '}
          or email{' '}
          <a href="mailto:sales@sundayharmony.com" className="text-accent hover:underline font-semibold">
            sales@sundayharmony.com
          </a>
        </p>
      </div>
    </div>
  )
}
