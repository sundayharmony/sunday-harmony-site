'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

function CancelForm() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const cancel = async () => {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/consultations/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Could not cancel')
      setStatus('done')
      setMessage(payload.already ? 'This consultation was already cancelled.' : 'This consultation is cancelled. The time is open again.')
    } catch (err: unknown) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Could not cancel')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-[560px] mx-auto px-7 py-20">
      <div className="section-label">Consultation</div>
      <h1 className="font-serif text-4xl font-extrabold text-brand-text mb-4">Cancel this time</h1>
      {!token ? (
        <p className="text-brand-muted">This page needs the link from your confirmation email.</p>
      ) : status === 'done' ? (
        <p className="text-brand-muted leading-relaxed">{message}</p>
      ) : (
        <>
          <p className="text-brand-muted leading-relaxed mb-6">
            Cancelling removes the Google Meet from the calendar and opens the slot for someone else.
          </p>
          {message ? <p className="text-sm text-red-700 mb-4">{message}</p> : null}
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={busy}
            className="px-6 py-3 rounded-lg bg-brand-text text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy ? 'Cancelling…' : 'Cancel the consultation'}
          </button>
        </>
      )}
    </div>
  )
}

export default function CancelConsultationPage() {
  return (
    <>
      <Navbar />
      <main id="main" className="pt-[var(--nav-total-height)] bg-white min-h-screen">
        <Suspense fallback={<p className="px-7 py-20 text-sm text-brand-muted">Loading…</p>}>
          <CancelForm />
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
