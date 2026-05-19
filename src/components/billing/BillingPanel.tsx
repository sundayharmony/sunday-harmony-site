'use client'

import { useCallback, useEffect, useState } from 'react'
import StripeElementsProvider from '@/components/billing/StripeElementsProvider'
import EmbeddedSubscribeForm from '@/components/billing/EmbeddedSubscribeForm'
import {
  formatTierListPrice,
  isFreeTier,
  PACKAGE_TIERS,
  TIER_LABELS,
  type PackageTier,
} from '@/lib/stripe-catalog'

export type BillingPanelClient = {
  id: string
  name: string
  email?: string
  is_potential?: boolean
  package_tier: string
  billing_status?: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
  next_billing_date?: string | null
  last_payment_at?: string | null
}

type PaymentMethodRow = {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  isDefault: boolean
}

export default function BillingPanel({
  client,
  adminView = false,
  onUpdated,
}: {
  client: BillingPanelClient
  adminView?: boolean
  onUpdated?: () => void
}) {
  const [tier, setTier] = useState<PackageTier>(
    (client.package_tier as PackageTier) || 'spark'
  )
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [setupLoading, setSetupLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([])
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const clientIdParam = adminView ? client.id : undefined

  const refreshPaymentMethods = useCallback(async () => {
    const q = adminView ? `?clientId=${encodeURIComponent(client.id)}` : ''
    try {
      const res = await fetch(`/api/billing/payment-methods${q}`)
      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data.paymentMethods)) {
        setPaymentMethods(data.paymentMethods)
      }
    } catch {
      setPaymentMethods([])
    }
  }, [adminView, client.id])

  const loadSetupIntent = useCallback(async () => {
    if (adminView || client.is_potential) return
    setSetupLoading(true)
    setError('')
    try {
      const res = await fetch('/api/billing/setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientIdParam ? { clientId: clientIdParam } : {}),
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
  }, [adminView, client.is_potential, clientIdParam])

  useEffect(() => {
    setTier((client.package_tier as PackageTier) || 'spark')
  }, [client.package_tier])

  useEffect(() => {
    void refreshPaymentMethods()
  }, [refreshPaymentMethods, client.stripe_customer_id])

  useEffect(() => {
    setCancelAtPeriodEnd(false)
    setShowPaymentForm(false)
    setClientSecret(null)
    setSuccessMessage('')
    setError('')
  }, [client.id, client.stripe_subscription_id, client.is_potential, client.package_tier])

  const billingLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/billing`

  const runCancel = async (action: 'cancel_at_period_end' | 'resume' | 'cancel_immediately') => {
    setBusy(action)
    setError('')
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(clientIdParam ? { clientId: clientIdParam } : {}),
          action,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Action failed')
        return
      }
      if (data.subscription && typeof data.subscription.cancel_at_period_end === 'boolean') {
        setCancelAtPeriodEnd(data.subscription.cancel_at_period_end)
      }
      onUpdated?.()
    } finally {
      setBusy(null)
    }
  }

  const openPaymentForm = () => {
    setShowPaymentForm(true)
    if (!clientSecret) void loadSetupIntent()
  }

  const clientOnFree = isFreeTier(client.package_tier)
  const selectedIsFree = isFreeTier(tier)

  const runChangePlan = async () => {
    if (!client.stripe_subscription_id?.trim() && !selectedIsFree) return
    setBusy('change_plan')
    setError('')
    setSuccessMessage('')
    try {
      const res = await fetch('/api/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(clientIdParam ? { clientId: clientIdParam } : {}),
          tier,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Plan change failed')
        return
      }
      if (data.free) {
        setCancelAtPeriodEnd(false)
      }
      setSuccessMessage('Plan updated.')
      onUpdated?.()
    } finally {
      setBusy(null)
    }
  }

  const runAdminSavePlan = async () => {
    setBusy('admin_plan')
    setError('')
    setSuccessMessage('')
    try {
      const res = await fetch('/api/admin/clients/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          tier,
          activateBilling: true,
          startStripeIfReady: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not save plan')
        return
      }
      setSuccessMessage(typeof data.message === 'string' ? data.message : 'Plan saved.')
      onUpdated?.()
    } finally {
      setBusy(null)
    }
  }

  const runAdminStartStripe = async () => {
    setBusy('admin_stripe')
    setError('')
    setSuccessMessage('')
    try {
      const res = await fetch('/api/admin/clients/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          tier: client.package_tier,
          activateBilling: false,
          startStripeIfReady: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not start subscription')
        return
      }
      setSuccessMessage(typeof data.message === 'string' ? data.message : 'Subscription updated.')
      onUpdated?.()
    } finally {
      setBusy(null)
    }
  }

  const planDirty = tier !== client.package_tier
  const showAdminSave =
    adminView && (planDirty || Boolean(client.is_potential))
  const showAdminStartStripe =
    adminView &&
    !client.is_potential &&
    !selectedIsFree &&
    !clientOnFree &&
    !client.stripe_subscription_id?.trim() &&
    paymentMethods.length > 0 &&
    !planDirty

  const ensureStripeCustomer = async () => {
    setBusy('customer')
    setError('')
    try {
      const res = await fetch('/api/admin/stripe/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Failed to link Stripe customer')
        return
      }
      onUpdated?.()
    } finally {
      setBusy(null)
    }
  }

  const syncFromStripe = async () => {
    setBusy('sync')
    setError('')
    try {
      const res = await fetch('/api/admin/stripe/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Sync failed')
        return
      }
      onUpdated?.()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4 text-sm">
      {error && (
        <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}

      {successMessage && (
        <div className="p-2 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs">{successMessage}</div>
      )}

      {clientOnFree && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900">
          <strong>Free testing tier</strong> — full dashboard access with no Stripe subscription or card required.
        </div>
      )}

      <div className="text-xs text-brand-muted space-y-1">
        <div>Payment status: <span className="font-semibold text-brand-text">{client.billing_status || 'not_started'}</span></div>
        {cancelAtPeriodEnd && client.next_billing_date && (
          <div className="text-amber-800 font-semibold">
            Cancels on {new Date(client.next_billing_date).toLocaleDateString()}
          </div>
        )}
        {!cancelAtPeriodEnd && client.next_billing_date && (
          <div>Next billing: {new Date(client.next_billing_date).toLocaleDateString()}</div>
        )}
        {client.last_payment_at && (
          <div>Last payment: {new Date(client.last_payment_at).toLocaleDateString()}</div>
        )}
      </div>

      {client.is_potential && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          {adminView
            ? 'Potential client — pick a plan below, then click Save plan. If they already have a card on file, we will start their Stripe subscription automatically.'
            : 'Potential client — contact Sunday Harmony to activate billing before subscribing.'}
        </p>
      )}

      {adminView && (
        <div className="rounded-lg border border-brand-border bg-neutral-50 p-3 space-y-2">
          <p className="text-xs text-brand-muted">
            Card details must be entered by the client on their dashboard (PCI). Copy this link for them:
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={billingLink}
              className="flex-1 text-xs py-1.5 px-2 rounded border border-brand-border bg-white"
            />
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(billingLink)}
              className="px-3 py-1.5 rounded-lg bg-accent-soft text-accent text-xs font-semibold"
            >
              Copy
            </button>
          </div>
          {!client.stripe_customer_id?.trim() && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void ensureStripeCustomer()}
              className="w-full py-2 rounded-lg bg-brand-text text-white text-xs font-bold disabled:opacity-50"
            >
              {busy === 'customer' ? 'Working…' : 'Create / link Stripe customer'}
            </button>
          )}
        </div>
      )}

      <div>
        <div className="text-[10px] font-bold uppercase text-brand-dim mb-2">Plan</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PACKAGE_TIERS.map(key => (
            <button
              key={key}
              type="button"
              disabled={!adminView && Boolean(client.is_potential)}
              onClick={() => setTier(key)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                tier === key
                  ? 'bg-accent-soft text-accent border border-accent'
                  : 'bg-gray-50 text-brand-dim border border-brand-border'
              }`}
            >
              {TIER_LABELS[key]} ({formatTierListPrice(key)})
            </button>
          ))}
        </div>
        {showAdminSave && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void runAdminSavePlan()}
            className="px-3 py-2 rounded-lg bg-accent text-white text-xs font-bold disabled:opacity-50"
          >
            {busy === 'admin_plan'
              ? 'Saving…'
              : client.is_potential
                ? planDirty
                  ? `Set plan & activate — ${TIER_LABELS[tier]}`
                  : `Activate billing — ${TIER_LABELS[tier]}`
                : planDirty
                  ? selectedIsFree
                    ? 'Switch to free (testing)'
                    : client.stripe_subscription_id?.trim()
                      ? 'Save plan (updates Stripe)'
                      : 'Save plan'
                  : 'Save plan'}
          </button>
        )}
        {!adminView &&
          (client.stripe_subscription_id?.trim() || selectedIsFree) &&
          tier !== client.package_tier && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void runChangePlan()}
              className="px-3 py-1.5 rounded-lg bg-white border border-brand-border text-xs font-semibold disabled:opacity-50"
            >
              {busy === 'change_plan'
                ? 'Updating…'
                : selectedIsFree
                  ? 'Switch to free (testing)'
                  : 'Apply plan change'}
            </button>
          )}
        {showAdminStartStripe && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void runAdminStartStripe()}
            className="mt-2 w-full px-3 py-2 rounded-lg bg-white border border-accent text-accent text-xs font-bold disabled:opacity-50"
          >
            {busy === 'admin_stripe' ? 'Starting…' : 'Start subscription with card on file'}
          </button>
        )}
      </div>

      {!adminView && !client.is_potential && !clientOnFree && !selectedIsFree && (
        <div className="rounded-lg border border-brand-border bg-white p-4">
          <div className="text-[10px] font-bold uppercase text-brand-dim mb-3">
            {client.stripe_subscription_id?.trim() ? 'Update payment & resubscribe' : 'Subscribe'}
          </div>
          {!showPaymentForm ? (
            <button
              type="button"
              onClick={openPaymentForm}
              className="w-full py-2 rounded-lg bg-accent-soft text-accent text-xs font-bold border border-accent"
            >
              {client.stripe_subscription_id?.trim() ? 'Add or update card' : 'Set up payment & subscribe'}
            </button>
          ) : (
            <>
              {setupLoading && <p className="text-xs text-brand-dim">Loading secure payment form…</p>}
              {!setupLoading && clientSecret && (
                <StripeElementsProvider clientSecret={clientSecret}>
                  <EmbeddedSubscribeForm
                    clientId={clientIdParam}
                    tier={tier}
                    onSuccess={() => {
                      onUpdated?.()
                      void refreshPaymentMethods()
                      setShowPaymentForm(false)
                      setClientSecret(null)
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
                {!adminView && !pm.isDefault && (
                  <button
                    type="button"
                    className="text-accent font-semibold"
                    onClick={async () => {
                      const res = await fetch('/api/billing/payment-methods', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paymentMethodId: pm.id }),
                      })
                      const data = await res.json().catch(() => ({}))
                      if (!res.ok) {
                        setError(typeof data.error === 'string' ? data.error : 'Could not update default card')
                        return
                      }
                      void refreshPaymentMethods()
                    }}
                  >
                    Make default
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {client.stripe_subscription_id?.trim() && !clientOnFree && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-brand-border">
          {!cancelAtPeriodEnd && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void runCancel('cancel_at_period_end')}
              className="px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-900 disabled:opacity-50"
            >
              Cancel at period end
            </button>
          )}
          {cancelAtPeriodEnd && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void runCancel('resume')}
              className="px-2 py-1.5 rounded-lg bg-green-50 border border-green-200 text-[10px] font-bold text-green-900 disabled:opacity-50"
            >
              Resume subscription
            </button>
          )}
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              if (!window.confirm('Cancel subscription immediately?')) return
              void runCancel('cancel_immediately')
            }}
            className="px-2 py-1.5 rounded-lg bg-red-50 border border-red-200 text-[10px] font-bold text-red-800 disabled:opacity-50"
          >
            Cancel now
          </button>
          {adminView && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void syncFromStripe()}
              className="px-2 py-1.5 rounded-lg bg-white border border-brand-border text-[10px] font-semibold disabled:opacity-50"
            >
              {busy === 'sync' ? '…' : 'Refresh from Stripe'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
