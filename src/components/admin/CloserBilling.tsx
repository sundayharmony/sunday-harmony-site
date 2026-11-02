'use client'

import { useCallback, useEffect, useState } from 'react'
import BillingPanel, { type BillingPanelClient } from '@/components/billing/BillingPanel'

export default function CloserBilling({
  prospectId,
  business,
  servicesPurchased,
  paymentStatus,
}: {
  prospectId: string
  business: string
  servicesPurchased?: string
  paymentStatus?: string
}) {
  const [client, setClient] = useState<BillingPanelClient | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)

  const load = useCallback(async (method: 'GET' | 'POST') => {
    if (method === 'POST') setOpening(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/pipeline/${prospectId}/billing`, { method })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not open billing')
        return
      }
      setClient(data.client || null)
    } catch {
      setError('Could not open billing')
    } finally {
      setLoading(false)
      setOpening(false)
    }
  }, [prospectId])

  useEffect(() => {
    void load('GET')
  }, [load])

  const detail = [servicesPurchased, paymentStatus].filter(Boolean).join(' · ')

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-brand-border/70 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="font-serif text-lg font-semibold text-brand-text">{business}</div>
          <p className="text-xs text-brand-muted mt-1">
            {detail || 'Active marketing client'}
          </p>
        </div>
        {!client && (
          <button
            type="button"
            disabled={loading || opening}
            onClick={() => void load('POST')}
            className="w-full sm:w-auto shrink-0 px-4 py-2 rounded-full bg-brand-text text-white text-sm font-semibold disabled:opacity-60"
          >
            {opening ? 'Opening…' : 'Bill client'}
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-brand-red">{error}</p>}
      {loading && !client && !error && <p className="mt-3 text-sm text-brand-muted">Checking billing…</p>}
      {client && (
        <div className="mt-4 border-t border-brand-border pt-4">
          <BillingPanel
            client={client}
            adminView
            marketingOnly
            onUpdated={() => void load('GET')}
          />
        </div>
      )}
    </div>
  )
}
