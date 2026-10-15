'use client'

import { FormEvent, useEffect, useState } from 'react'

type Slot = { startsAt: string; endsAt: string; label: string }
type Day = { date: string; label: string; slots: Slot[] }

type SlotsResponse = {
  calendarConnected: boolean
  timezone: string
  days: Day[]
}

export default function ConsultationBooker() {
  const [data, setData] = useState<SlotsResponse | null>(null)
  const [loadError, setLoadError] = useState('')
  const [day, setDay] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [business, setBusiness] = useState('')
  const [note, setNote] = useState('')
  const [hp, setHp] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [booked, setBooked] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/consultations/slots')
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload.error || 'Could not load times')
        if (!cancelled) {
          setData(payload)
          setDay(payload.days?.[0]?.date || '')
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load times')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedDay = data?.days.find((item) => item.date === day) ?? data?.days[0]

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSending(true)
    try {
      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, business, note, startsAt, shHpField: hp }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Could not book that time')
      setBooked(payload.whenLabel || 'your selected time')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not book that time')
    } finally {
      setSending(false)
    }
  }

  if (booked) {
    return (
      <div className="rounded-3xl border border-brand-border bg-white p-8 sm:p-10 text-center">
        <div className="text-4xl mb-3 text-accent">✓</div>
        <h3 className="font-serif text-3xl font-extrabold text-brand-text mb-3">You are on the calendar.</h3>
        <p className="text-brand-muted leading-relaxed max-w-[460px] mx-auto">
          {booked}. The Google Meet link is in your email. Check the inbox you entered, including promotions or spam, if it is not in front.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-brand-border bg-white p-6 sm:p-8 shadow-sm">
      <div className="hidden" aria-hidden="true">
        <label htmlFor="consult-hp">Office fax</label>
        <input id="consult-hp" value={hp} onChange={(event) => setHp(event.target.value)} tabIndex={-1} autoComplete="off" />
      </div>

      {loadError ? <p className="text-sm text-red-700">{loadError}</p> : null}
      {!data && !loadError ? <p className="text-sm text-brand-muted">Loading open times…</p> : null}

      {data && !data.calendarConnected ? (
        <p className="text-sm text-brand-muted leading-relaxed">
          Online booking is not open yet. Send a message below and we will find a time with you.
        </p>
      ) : null}

      {data?.calendarConnected && data.days.length === 0 ? (
        <p className="text-sm text-brand-muted leading-relaxed">
          No open times right now. Send a message below and we will write back.
        </p>
      ) : null}

      {data?.calendarConnected && data.days.length > 0 ? (
        <form onSubmit={submit} className="space-y-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-dim mb-3">Pick a day</p>
            <div className="flex gap-2 flex-wrap">
              {data.days.map((item) => (
                <button
                  key={item.date}
                  type="button"
                  onClick={() => {
                    setDay(item.date)
                    setStartsAt('')
                  }}
                  className={`px-4 py-2 rounded-full border text-sm font-semibold transition-colors ${
                    (selectedDay?.date === item.date)
                      ? 'bg-brand-text text-white border-brand-text'
                      : 'bg-white text-brand-text border-brand-border hover:border-neutral-400'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {selectedDay ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-dim mb-3">Pick a time</p>
              <div className="flex gap-2 flex-wrap">
                {selectedDay.slots.map((slot) => (
                  <button
                    key={slot.startsAt}
                    type="button"
                    onClick={() => setStartsAt(slot.startsAt)}
                    className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                      startsAt === slot.startsAt
                        ? 'bg-accent-soft text-brand-text border-accent'
                        : 'bg-white text-brand-muted border-brand-border hover:border-neutral-400'
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {startsAt ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="block text-xs font-semibold text-brand-muted">
                Name *
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1.5 w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-brand-muted">
                Email *
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1.5 w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-brand-muted">
                Phone
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-1.5 w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-brand-muted">
                Business *
                <input
                  required
                  value={business}
                  onChange={(event) => setBusiness(event.target.value)}
                  className="mt-1.5 w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-brand-muted sm:col-span-2">
                What should we talk about?
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  className="mt-1.5 w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm"
                />
              </label>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <button
            type="submit"
            disabled={!startsAt || sending}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-brand-text text-white text-sm font-semibold disabled:opacity-50"
          >
            {sending ? 'Booking…' : 'Book this time'}
          </button>
        </form>
      ) : null}
    </div>
  )
}
