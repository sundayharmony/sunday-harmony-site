'use client'

import { useState, useEffect, useMemo } from 'react'
import StatCard from '@/components/ui/StatCard'
import BillingPanel from '@/components/billing/BillingPanel'
import { TIER_LABELS } from '@/lib/stripe-catalog'

interface ClientData {
  id: string
  name: string
  business: string
  package_tier: string
  monthly_price: number
  start_date: string
  status: string
  is_potential?: boolean
  billing_status?: string
  next_billing_date?: string | null
  last_payment_at?: string | null
  stripe_customer_id?: string
  stripe_subscription_id?: string
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
}

const statusStyles: Record<string, { color: string; bg: string }> = {
  paid: { color: '#2d8a62', bg: '#f0fdf4' },
  current: { color: '#2e7bb5', bg: '#eff6ff' },
  overdue: { color: '#c94a42', bg: '#fef2f2' },
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

  const load = async () => {
    try {
      const [profileRes, invRes] = await Promise.all([
        fetch('/api/dashboard/profile'),
        fetch('/api/dashboard/billing/invoices'),
      ])
      const profile = profileRes.ok ? await profileRes.json() : null
      setClient(profile)
      const invPayload = invRes.ok ? await invRes.json().catch(() => ({})) : {}
      setInvoices(Array.isArray(invPayload.invoices) ? invPayload.invoices : [])
      setInvoiceNote(typeof invPayload.message === 'string' ? invPayload.message : null)
    } catch {
      setClient(null)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const monthlyPrice = client?.monthly_price || 0
  const totalPaid = useMemo(
    () => invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.amount_paid || 0), 0),
    [invoices]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-brand-muted text-sm">Loading...</div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="p-8 text-center text-brand-muted text-sm">
        Unable to load billing profile. Please contact support.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Billing</h1>
        <p className="text-sm text-brand-muted">
          Manage your plan and payment method without leaving your dashboard.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Current Plan"
          value={TIER_LABELS[client.package_tier as keyof typeof TIER_LABELS] || client.package_tier}
          color="accent"
        />
        <StatCard label="Monthly Rate" value={`$${monthlyPrice.toLocaleString()}`} />
        <StatCard
          label="Total Paid"
          value={formatMoneyCents(totalPaid, invoices[0]?.currency || 'usd')}
        />
        <StatCard
          label="Payment Status"
          value={(client.billing_status || 'not_started').replace('_', ' ')}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-brand-border rounded-2xl p-6">
          <h2 className="text-base font-bold text-brand-text mb-4">Subscription</h2>
          {client.is_potential ? (
            <p className="text-sm text-brand-muted">
              Your account is marked as a potential engagement. Contact Sunday Harmony to activate billing.
            </p>
          ) : (
            <BillingPanel client={client} onUpdated={() => void load()} />
          )}
        </div>

        <div className="bg-white border border-brand-border rounded-2xl p-6">
          <h2 className="text-base font-bold text-brand-text mb-4">Invoice History</h2>
          {invoices.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {invoices.map(inv => {
                const cents = inv.amount_paid > 0 ? inv.amount_paid : inv.amount_due
                const when = inv.created
                  ? new Date(inv.created * 1000).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'
                const style =
                  inv.status === 'paid'
                    ? statusStyles.paid
                    : statusStyles.current
                return (
                  <div
                    key={inv.id}
                    className="flex justify-between items-center py-2 px-3 rounded-lg bg-gray-50 border border-brand-border text-sm"
                  >
                    <div>
                      <div className="font-mono text-xs">{inv.number || inv.id}</div>
                      <div className="text-brand-dim text-xs">{when}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatMoneyCents(cents, inv.currency)}</div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                        style={{ color: style.color, background: style.bg }}
                      >
                        {inv.status}
                      </span>
                      {inv.hosted_invoice_url && (
                        <div>
                          <a
                            href={inv.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-accent font-semibold hover:underline"
                          >
                            Receipt
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-brand-dim text-center py-6">
              {invoiceNote || 'No invoices yet.'}
            </p>
          )}
        </div>
      </div>

      <div className="bg-accent-soft border border-accent rounded-xl p-4 text-center">
        <p className="text-sm text-brand-muted">
          Questions?{' '}
          <a href="/dashboard/messages" className="text-accent font-semibold hover:underline">
            Message us
          </a>
        </p>
      </div>
    </div>
  )
}
