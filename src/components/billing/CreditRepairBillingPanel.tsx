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
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([])
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
        const res = await fetch(`/api/billing/payment-methods${q}`)
        const data = await res.json().catch(() => ({}))
        if (res.ok && Array.isArray(data.paymentMethods)) {
          setPaymentMethods(data.paymentMethods)
        }
      } catch {
        setPaymentMethods([])
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
      const nextClient = data.client as CreditRepairBillingClient | undefined
      if (nextClient) {
        setPaidAt(nextClient.repair_fee_paid_at || '')
        setFeeCents(nextClient.repair_fee_cents ?? null)
        setStatus(nextClient.billing_status || 'not_started')
      }
      if (typeof data.defaultFeeCents === 'number' && !defaultLoaded) {
        setAmount((data.defaultFeeCents / 100).toFixed(2))
        setDefaultLoaded(true)
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
          This client is not on a marketing subscription. Charge a one-time repair fee, or email a Stripe invoice.
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
              {busy === 'charge' ? 'Charging…' : 'Charge card on file'}
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
    </div>
  )
}

export function usesCreditRepairBilling(client: CreditRepairBillingClient): boolean {
  return isCreditRepairBillingClient(client)
}
