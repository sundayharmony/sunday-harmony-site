'use client'

import { FormEvent, useEffect, useState } from 'react'

type Slot = { startsAt: string; endsAt: string; label: string }
type Day = { date: string; label: string; slots: Slot[] }

type SlotsResponse = {
  calendarConnected: boolean
  timezone: string
  days: Day[]
}

type Step = 'day' | 'time' | 'details'

const TIMEZONE_LABELS: Record<string, string> = {
  'America/New_York': 'Eastern Time',
  'America/Chicago': 'Central Time',
  'America/Denver': 'Mountain Time',
  'America/Phoenix': 'Arizona Time',
  'America/Los_Angeles': 'Pacific Time',
  'America/Anchorage': 'Alaska Time',
  'Pacific/Honolulu': 'Hawaii Time',
  UTC: 'UTC',
}

function timezoneLabel(zone: string): string {
  return TIMEZONE_LABELS[zone] || zone.replaceAll('_', ' ')
}

const choiceClass = (selected: boolean, shape: 'pill' | 'tile') =>
  `px-4 py-2.5 border text-sm font-semibold transition-colors ${
    shape === 'pill' ? 'rounded-full' : 'rounded-lg'
  } ${
    selected
      ? shape === 'pill'
        ? 'bg-brand-text text-white border-brand-text'
        : 'bg-accent-soft text-brand-text border-accent'
      : 'bg-white text-brand-text border-brand-border hover:border-neutral-400'
  }`

export default function ConsultationBooker() {
  const [data, setData] = useState<SlotsResponse | null>(null)
  const [loadError, setLoadError] = useState('')
  const [step, setStep] = useState<Step>('day')
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
        if (!cancelled) setData(payload)
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load times')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedDay = data?.days.find((item) => item.date === day) ?? null
  const selectedSlot = selectedDay?.slots.find((slot) => slot.startsAt === startsAt) ?? null

  const chooseDay = (date: string) => {
    setDay(date)
    setStartsAt('')
    setError('')
    setStep('time')
  }

  const backToDays = () => {
    setStartsAt('')
    setError('')
    setStep('day')
  }

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
        <h2 className="font-serif text-3xl font-extrabold text-brand-text mb-3">You are on the calendar.</h2>
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
      {!data && !loadError ? <p className="text-sm text-brand-muted">Loading open days…</p> : null}

      {data && !data.calendarConnected ? (
        <p className="text-sm text-brand-muted leading-relaxed">
          Online booking is not open yet.{' '}
          <a href="/contact#message" className="font-semibold text-brand-text hover:text-accent">
            Send a message
          </a>{' '}
          and we will find a time with you.
        </p>
      ) : null}

      {data?.calendarConnected && data.days.length === 0 ? (
        <p className="text-sm text-brand-muted leading-relaxed">
          No open times right now.{' '}
          <a href="/contact#message" className="font-semibold text-brand-text hover:text-accent">
            Send a message
          </a>{' '}
          and we will write back.
        </p>
      ) : null}

      {data?.calendarConnected && data.days.length > 0 ? (
        <form onSubmit={submit} className="space-y-6">
          <ol className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
            <li className={step === 'day' ? 'text-brand-text' : 'text-brand-dim'}>1 Date</li>
            <li className="text-brand-dim" aria-hidden>
              →
            </li>
            <li className={step === 'time' ? 'text-brand-text' : 'text-brand-dim'}>2 Time</li>
            <li className="text-brand-dim" aria-hidden>
              →
            </li>
            <li className={step === 'details' ? 'text-brand-text' : 'text-brand-dim'}>3 Details</li>
          </ol>

          {step === 'day' ? (
            <div>
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-dim">Pick a day</p>
                <p className="text-xs text-brand-muted">{timezoneLabel(data.timezone)}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data.days.map((item) => (
                  <button
                    key={item.date}
                    type="button"
                    onClick={() => chooseDay(item.date)}
                    className={choiceClass(false, 'pill')}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 'time' && selectedDay ? (
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-semibold text-brand-text">{selectedDay.label}</p>
                <button type="button" onClick={backToDays} className="text-xs font-semibold text-accent hover:underline">
                  Change date
                </button>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-dim mb-3">
                Pick a time · {timezoneLabel(data.timezone)}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {selectedDay.slots.map((slot) => (
                  <button
                    key={slot.startsAt}
                    type="button"
                    onClick={() => {
                      setStartsAt(slot.startsAt)
                      setError('')
                      setStep('details')
                    }}
                    className={choiceClass(false, 'tile')}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 'details' && selectedDay && selectedSlot ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-border bg-neutral-50 px-4 py-3">
                <p className="text-sm font-semibold text-brand-text">
                  {selectedDay.label}
                  <span className="text-brand-muted font-medium"> · {selectedSlot.label}</span>
                </p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep('time')} className="text-xs font-semibold text-accent hover:underline">
                    Change time
                  </button>
                  <button type="button" onClick={backToDays} className="text-xs font-semibold text-accent hover:underline">
                    Change date
                  </button>
                </div>
              </div>
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
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              <button
                type="submit"
                disabled={!startsAt || sending}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-brand-text text-white text-sm font-semibold disabled:opacity-50"
              >
                {sending ? 'Booking…' : 'Book this time'}
              </button>
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  )
}
