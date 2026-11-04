'use client'

import { useRef, useState } from 'react'

type SendResponse = {
  error?: string
  message?: string
  paid?: boolean
  setupRequired?: boolean
  idempotencyConsumed?: boolean
  stripeId?: string
  alreadySent?: boolean
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `payout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function ReferrerPayoutForm({
  clientId,
  setupMessage,
  onComplete,
}: {
  clientId: string
  setupMessage?: string | null
  onComplete?: () => Promise<void> | void
}) {
  const [amount, setAmount] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const sending = useRef(false)
  const amountId = `payout-amount-${clientId}`

  const send = async () => {
    if (sending.current || locked) return
    sending.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/admin/referrals/${encodeURIComponent(clientId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_payout',
          amount,
          idempotencyKey,
        }),
      })
      const payload = (await res.json().catch(() => ({}))) as SendResponse
      if (!res.ok) {
        setError(payload.error || 'Stripe did not send this payout.')
        if (payload.idempotencyConsumed) {
          setIdempotencyKey(newIdempotencyKey())
        }
        return
      }
      setNotice(payload.message || 'Payout sent.')
      setLocked(true)
      await onComplete?.()
    } catch {
      setError('The payout request did not finish. Use Send payout again to retry this same amount. It will not send twice.')
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  return (
    <form
      className="mt-4"
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
    >
      {setupMessage ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{setupMessage}</p>
      ) : (
        <p className="mb-3 text-sm text-brand-muted">
          Enter the amount to send. Stripe transfers it to this client’s payout account. Nothing is marked paid until Stripe creates the transfer.
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 text-sm" htmlFor={amountId}>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-dim">Amount (USD)</span>
          <input
            id={amountId}
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            disabled={busy || locked}
            onChange={(event) => {
              setAmount(event.target.value)
              if (locked) {
                setLocked(false)
                setNotice('')
                setIdempotencyKey(newIdempotencyKey())
              }
            }}
            className="w-full rounded-lg border border-brand-border bg-white px-3 py-2.5 text-sm text-brand-text"
          />
        </label>
        <button
          type="submit"
          disabled={busy || locked}
          className="w-full shrink-0 rounded-lg bg-brand-text px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
        >
          {busy ? 'Sending…' : locked ? 'Sent' : 'Send payout'}
        </button>
      </div>
      {locked ? (
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-accent hover:underline"
          onClick={() => {
            setLocked(false)
            setAmount('')
            setNotice('')
            setError('')
            setIdempotencyKey(newIdempotencyKey())
          }}
        >
          Send another amount
        </button>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-green-800">{notice}</p> : null}
    </form>
  )
}
