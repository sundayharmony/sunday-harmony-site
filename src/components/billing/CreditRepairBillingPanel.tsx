'use client'

import { useCallback, useEffect, useState } from 'react'
import StripeElementsProvider from '@/components/billing/StripeElementsProvider'
import EmbeddedSubscribeForm from '@/components/billing/EmbeddedSubscribeForm'
import { formatRepairFeeCents, isCreditRepairBillingClient } from '@/lib/credit-repair-billing'

type PaymentMethodRow = {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  isDefault: boolean
}

type InvoiceRow = {
  id: string
  number: string | null
  status: string | null
  amount_paid: number
  amount_due: number
  currency: string
  hosted_invoice_url: string | null
  invoice_pdf?: string | null
  created: number
  paid_at?: string | null
}

export type CreditRepairBillingClient = {
  id: string
  email?: string
  is_potential?: boolean
  billing_status?: string
  billing_model?: string | null
  lead_type?: string | null
  repair_fee_cents?: number | null
  repair_fee_paid_at?: string | null
  stripe_repair_invoice_id?: string | null
  last_payment_at?: string | null
  stripe_customer_id?: string
}

export default function CreditRepairBillingPanel({
  client,
  applicationId,
  adminView = false,
  onUpdated,
}: {
  client: CreditRepairBillingClient
  applicationId?: string
  adminView?: boolean
  onUpdated?: () => void
}) {
  const [amount, setAmount] = useState(
    client.repair_fee_cents != null ? (client.repair_fee_cents / 100).toFixed(2) : ''
  )
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [paidAt, setPaidAt] = useState(client.repair_fee_paid_at || '')
  const [feeCents, setFeeCents] = useState(client.repair_fee_cents ?? null)
  const [status, setStatus] = useState(client.billing_status || 'not_started')
  const [hostedInvoiceUrl, setHostedInvoiceUrl] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [setupLoading, setSetupLoading] = useState(false)
  const [defaultLoaded, setDefaultLoaded] = useState(false)

  const snapshotUrl = applicationId
    ? `/api/admin/credit-funding/${encodeURIComponent(applicationId)}/repair-billing`
    : `/api/admin/clients/repair-billing?clientId=${encodeURIComponent(client.id)}`

  const chargeUrl = applicationId
    ? `/api/admin/credit-funding/${encodeURIComponent(applicationId)}/repair-billing`
    : '/api/admin/clients/repair-billing'

  const billingLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/billing`

  const refresh = useCallback(async () => {
    if (!adminView) {
      const q = `?clientId=${encodeURIComponent(client.id)}`
      try {
        const [pmRes, invRes] = await Promise.all([
          fetch(`/api/billing/payment-methods${q}`),
          fetch('/api/dashboard/billing/invoices'),
        ])
        const pmData = await pmRes.json().catch(() => ({}))
        const invData = await invRes.json().catch(() => ({}))
        if (pmRes.ok && Array.isArray(pmData.paymentMethods)) {
          setPaymentMethods(pmData.paymentMethods)
        }
        if (invRes.ok && Array.isArray(invData.invoices)) {
          setInvoices(invData.invoices)
        }
      } catch {
        setPaymentMethods([])
        setInvoices([])
      }
      return
    }

    try {
      const res = await fetch(snapshotUrl)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not load repair billing')
        return
      }
      if (Array.isArray(data.paymentMethods)) setPaymentMethods(data.paymentMethods)
      if (Array.isArray(data.invoices)) setInvoices(data.invoices)
      const nextClient = data.client as CreditRepairBillingClient | undefined
      if (nextClient) {
        setPaidAt(nextClient.repair_fee_paid_at || '')
        setFeeCents(nextClient.repair_fee_cents ?? null)
        setStatus(nextClient.billing_status || 'not_started')
      }
      if (!defaultLoaded) {
        const cents =
          typeof nextClient?.repair_fee_cents === 'number'
            ? nextClient.repair_fee_cents
            : typeof data.defaultFeeCents === 'number'
              ? data.defaultFeeCents
              : null
        if (cents != null) {
          setAmount((cents / 100).toFixed(2))
          setDefaultLoaded(true)
        }
      }
    } catch {
      setError('Could not load repair billing')
    }
  }, [adminView, client.id, defaultLoaded, snapshotUrl])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadSetupIntent = async () => {
    setSetupLoading(true)
    setError('')
    try {
      const res = await fetch('/api/billing/setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not start payment setup')
        setClientSecret(null)
        return
      }
      setClientSecret(data.clientSecret || null)
    } catch {
      setError('Could not load payment form')
    } finally {
      setSetupLoading(false)
    }
  }

  const charge = async (sendInvoice: boolean) => {
    setBusy(sendInvoice ? 'invoice' : 'charge')
    setError('')
    setSuccess('')
    try {
      const res = await fetch(chargeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(applicationId ? {} : { clientId: client.id }),
          amount,
          sendInvoice,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not charge repair fee')
        return
      }
      setSuccess(typeof data.message === 'string' ? data.message : 'Repair fee processed.')
      if (typeof data.hostedInvoiceUrl === 'string') setHostedInvoiceUrl(data.hostedInvoiceUrl)
      const nextClient = data.client as CreditRepairBillingClient | undefined
      if (nextClient) {
        setPaidAt(nextClient.repair_fee_paid_at || '')
        setFeeCents(nextClient.repair_fee_cents ?? null)
        setStatus(nextClient.billing_status || 'not_started')
      }
      onUpdated?.()
      void refresh()
    } finally {
      setBusy(null)
    }
  }

  const paid = Boolean(paidAt) || status === 'paid'

  return (
    <div className="space-y-4 text-sm">
      {error && (
        <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}
      {success && (
        <div className="p-2 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs">{success}</div>
      )}

      <div className="rounded-lg border border-brand-border bg-neutral-50 p-3 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-dim">Credit repair billing</p>
        <p className="text-xs text-brand-muted">
          Credit repair is a one-time fee, not a marketing subscription. If a card is on file it is charged;
          otherwise we email a Stripe invoice they can pay. They always get an invoice or receipt.
        </p>
        <div className="text-xs text-brand-text pt-1">
          Status: <span className="font-semibold">{paid ? 'Paid' : status.replace(/_/g, ' ')}</span>
          {feeCents != null && (
            <>
              {' · '}Fee: <span className="font-semibold">{formatRepairFeeCents(feeCents)}</span>
            </>
          )}
          {paidAt && (
            <>
              {' · '}Paid {new Date(paidAt).toLocaleDateString()}
            </>
          )}
        </div>
        {hostedInvoiceUrl && (
          <a
            href={hostedInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-accent hover:underline"
          >
            Open invoice
          </a>
        )}
      </div>

      {adminView && (
        <>
          <div>
            <label className="text-[10px] font-bold uppercase text-brand-dim block mb-1">Repair fee (USD)</label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="499.00"
              className="w-full py-2 px-3 rounded-lg border border-brand-border bg-white text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null || !amount.trim()}
              onClick={() => void charge(false)}
              className="px-3 py-2 rounded-lg bg-brand-text text-white text-xs font-bold disabled:opacity-50"
            >
              {busy === 'charge' ? 'Charging…' : paymentMethods.length > 0 ? 'Charge card on file' : 'Charge or email invoice'}
            </button>
            <button
              type="button"
              disabled={busy !== null || !amount.trim()}
              onClick={() => void charge(true)}
              className="px-3 py-2 rounded-lg bg-white border border-accent text-accent text-xs font-bold disabled:opacity-50"
            >
              {busy === 'invoice' ? 'Sending…' : 'Email invoice'}
            </button>
          </div>
          {paymentMethods.length === 0 && (
            <p className="text-xs text-brand-muted">
              No card on file. Sending an invoice emails a pay link and saves it in payment history.
            </p>
          )}
          <div className="rounded-lg border border-brand-border bg-white p-3 space-y-2">
            <p className="text-xs text-brand-muted">
              Card details must be entered by the client. Copy this billing link:
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={billingLink}
                className="flex-1 text-xs py-1.5 px-2 rounded border border-brand-border bg-neutral-50"
              />
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(billingLink)}
                className="px-3 py-1.5 rounded-lg bg-accent-soft text-accent text-xs font-semibold"
              >
                Copy
              </button>
            </div>
          </div>
        </>
      )}

      {!adminView && (
        <div className="rounded-lg border border-brand-border bg-white p-4">
          <div className="text-[10px] font-bold uppercase text-brand-dim mb-3">Payment method</div>
          {!showPaymentForm ? (
            <button
              type="button"
              onClick={() => {
                setShowPaymentForm(true)
                if (!clientSecret) void loadSetupIntent()
              }}
              className="w-full py-2 rounded-lg bg-accent-soft text-accent text-xs font-bold border border-accent"
            >
              Add or update card
            </button>
          ) : (
            <>
              {setupLoading && <p className="text-xs text-brand-dim">Loading secure payment form…</p>}
              {!setupLoading && clientSecret && (
                <StripeElementsProvider clientSecret={clientSecret}>
                  <EmbeddedSubscribeForm
                    onSuccess={() => {
                      setSuccess('Card saved.')
                      setShowPaymentForm(false)
                      setClientSecret(null)
                      void refresh()
                    }}
                    onError={setError}
                  />
                </StripeElementsProvider>
              )}
            </>
          )}
        </div>
      )}

      {paymentMethods.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase text-brand-dim mb-2">Cards on file</div>
          <ul className="space-y-1.5">
            {paymentMethods.map(pm => (
              <li
                key={pm.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 border border-brand-border text-xs"
              >
                <span>
                  {pm.brand} •••• {pm.last4}
                  {pm.isDefault && (
                    <span className="ml-2 text-[10px] font-bold text-accent uppercase">Default</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {invoices.length > 0 ? (
        <div>
          <div className="text-[10px] font-bold uppercase text-brand-dim mb-2">Payment history</div>
          <ul className="space-y-1.5">
            {invoices.map(inv => {
              const cents = inv.amount_paid > 0 ? inv.amount_paid : inv.amount_due
              const when = inv.paid_at
                ? new Date(inv.paid_at).toLocaleDateString()
                : inv.created
                  ? new Date(inv.created * 1000).toLocaleDateString()
                  : '—'
              return (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-gray-50 border border-brand-border text-xs"
                >
                  <div>
                    <div className="font-semibold text-brand-text">{inv.number || inv.id}</div>
                    <div className="text-brand-dim">
                      {when} · {(inv.status || 'open').replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatRepairFeeCents(cents)}</div>
                    {inv.hosted_invoice_url && (
                      <a
                        href={inv.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent font-semibold hover:underline"
                      >
                        {inv.status === 'paid' ? 'Receipt' : 'Invoice'}
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div>
          <div className="text-[10px] font-bold uppercase text-brand-dim mb-2">Payment history</div>
          <p className="text-xs text-brand-muted">
            No invoices yet. Charging a card or emailing an invoice will show each payment here.
          </p>
        </div>
      )}
    </div>
  )
}

export function usesCreditRepairBilling(client: CreditRepairBillingClient): boolean {
  return isCreditRepairBillingClient(client)
}
