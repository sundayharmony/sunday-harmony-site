'use client'

import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useState } from 'react'

export default function EmbeddedSubscribeForm({
  clientId,
  onSuccess,
  onError,
}: {
  clientId?: string
  onSuccess: () => void
  onError: (message: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setBusy(true)
    onError('')

    try {
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      })

      if (confirmError) {
        onError(confirmError.message || 'Payment setup failed')
        return
      }

      const paymentMethodId =
        typeof setupIntent?.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent?.payment_method?.id

      if (!paymentMethodId) {
        onError('No payment method returned')
        return
      }

      const res = await fetch('/api/billing/save-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(clientId ? { clientId } : {}),
          paymentMethodId,
        }),
      })
      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        onError(typeof payload.error === 'string' ? payload.error : 'Could not save card')
        return
      }

      onSuccess()
    } catch (err) {
      console.error(err)
      onError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || !elements || busy}
        className="w-full py-2.5 rounded-lg bg-brand-text text-white text-sm font-bold disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save card'}
      </button>
    </form>
  )
}
