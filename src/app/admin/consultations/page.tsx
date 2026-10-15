'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type Hour = { weekday: number; startMinute: number; endMinute: number }
type Booking = {
  id: string
  name: string
  email: string
  business: string
  whenLabel: string
  meetLink: string | null
}

type Payload = {
  calendarConnected: boolean
  settings: {
    timezone: string
    slotMinutes: number
    bufferMinutes: number
    windowDays: number
    minLeadMinutes: number
  }
  hours: Hour[]
  blackouts: string[]
  bookings: Booking[]
}

function toTime(minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function fromTime(value: string): number {
  const [hh, mm] = value.split(':').map(Number)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
  return hh * 60 + mm
}

export default function AdminConsultationsPage() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [timezone, setTimezone] = useState('America/New_York')
  const [slotMinutes, setSlotMinutes] = useState(30)
  const [bufferMinutes, setBufferMinutes] = useState(0)
  const [windowDays, setWindowDays] = useState(14)
  const [enabled, setEnabled] = useState<boolean[]>(() => WEEKDAYS.map(() => false))
  const [start, setStart] = useState<string[]>(() => WEEKDAYS.map(() => '10:00'))
  const [end, setEnd] = useState<string[]>(() => WEEKDAYS.map(() => '16:00'))
  const [blackouts, setBlackouts] = useState<string[]>([])
  const [blackoutDraft, setBlackoutDraft] = useState('')
  const [busyId, setBusyId] = useState('')

  const apply = useCallback((data: Payload) => {
    setPayload(data)
    setTimezone(data.settings.timezone)
    setSlotMinutes(data.settings.slotMinutes)
    setBufferMinutes(data.settings.bufferMinutes)
    setWindowDays(data.settings.windowDays)
    const nextEnabled = WEEKDAYS.map(() => false)
    const nextStart = WEEKDAYS.map(() => '10:00')
    const nextEnd = WEEKDAYS.map(() => '16:00')
    for (const hour of data.hours) {
      nextEnabled[hour.weekday] = true
      nextStart[hour.weekday] = toTime(hour.startMinute)
      nextEnd[hour.weekday] = toTime(hour.endMinute)
    }
    setEnabled(nextEnabled)
    setStart(nextStart)
    setEnd(nextEnd)
    setBlackouts(data.blackouts)
  }, [])

  const load = useCallback(async () => {
    setError('')
    const res = await fetch('/api/admin/consultations')
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Could not load consultations')
      return
    }
    apply(data)
  }, [apply])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNote('')
    const hours = enabled.flatMap((on, weekday) =>
      on ? [{ weekday, startMinute: fromTime(start[weekday]), endMinute: fromTime(end[weekday]) }] : []
    )
    try {
      const res = await fetch('/api/admin/consultations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone, slotMinutes, bufferMinutes, windowDays, hours, blackouts }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save')
      setNote('Availability saved.')
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const useWeekdayPreset = () => {
    setEnabled(WEEKDAYS.map((_, index) => index >= 1 && index <= 5))
    setStart(WEEKDAYS.map(() => '10:00'))
    setEnd(WEEKDAYS.map(() => '16:00'))
  }

  const cancelBooking = async (id: string) => {
    setBusyId(id)
    setError('')
    try {
      const res = await fetch('/api/admin/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not cancel')
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not cancel')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-brand-text mb-1">Consultations</h1>
      <p className="text-sm text-brand-muted mb-6">
        Open hours show up on the contact page. Each booking creates a Google Meet on your calendar.
      </p>
      {payload && !payload.calendarConnected ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Google Calendar is not connected. You can save hours now. Visitors cannot book until the Calendar env vars are set.
        </p>
      ) : null}
      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}
      {note ? <p className="mb-4 text-sm text-brand-text">{note}</p> : null}

      <form onSubmit={save} className="bg-white border border-brand-border rounded-xl p-5 mb-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-brand-muted">
            Timezone
            <input
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="mt-1.5 w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-sm text-brand-text"
            />
          </label>
          <label className="text-xs font-semibold text-brand-muted">
            Appointment length (minutes)
            <input
              type="number"
              min={15}
              max={180}
              value={slotMinutes}
              onChange={(event) => setSlotMinutes(Number(event.target.value))}
              className="mt-1.5 w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-sm text-brand-text"
            />
          </label>
          <label className="text-xs font-semibold text-brand-muted">
            Buffer between meetings (minutes)
            <input
              type="number"
              min={0}
              max={120}
              value={bufferMinutes}
              onChange={(event) => setBufferMinutes(Number(event.target.value))}
              className="mt-1.5 w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-sm text-brand-text"
            />
          </label>
          <label className="text-xs font-semibold text-brand-muted">
            Days ahead visitors can book
            <input
              type="number"
              min={1}
              max={60}
              value={windowDays}
              onChange={(event) => setWindowDays(Number(event.target.value))}
              className="mt-1.5 w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-sm text-brand-text"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-brand-text">Weekly hours</h2>
          <button type="button" onClick={useWeekdayPreset} className="text-sm font-semibold text-accent">
            Use weekdays 10:00–4:00
          </button>
        </div>
        <div className="space-y-2">
          {WEEKDAYS.map((label, weekday) => (
            <div key={label} className="grid grid-cols-[1.2fr_auto_1fr_1fr] items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-brand-text">
                <input
                  type="checkbox"
                  checked={enabled[weekday]}
                  onChange={(event) =>
                    setEnabled((prev) => prev.map((value, index) => (index === weekday ? event.target.checked : value)))
                  }
                />
                {label}
              </label>
              <span className="text-xs text-brand-dim">from</span>
              <input
                type="time"
                value={start[weekday]}
                disabled={!enabled[weekday]}
                onChange={(event) =>
                  setStart((prev) => prev.map((value, index) => (index === weekday ? event.target.value : value)))
                }
                className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm disabled:opacity-40"
              />
              <input
                type="time"
                value={end[weekday]}
                disabled={!enabled[weekday]}
                onChange={(event) =>
                  setEnd((prev) => prev.map((value, index) => (index === weekday ? event.target.value : value)))
                }
                className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm disabled:opacity-40"
              />
            </div>
          ))}
        </div>

        <div>
          <h2 className="text-sm font-bold text-brand-text mb-2">Blackout dates</h2>
          <div className="flex gap-2 mb-3">
            <input
              type="date"
              value={blackoutDraft}
              onChange={(event) => setBlackoutDraft(event.target.value)}
              className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm"
            />
            <button
              type="button"
              className="px-4 py-2 border border-brand-border rounded-lg text-sm font-semibold"
              onClick={() => {
                if (!blackoutDraft || blackouts.includes(blackoutDraft)) return
                setBlackouts((prev) => [...prev, blackoutDraft].sort())
                setBlackoutDraft('')
              }}
            >
              Add date
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {blackouts.map((date) => (
              <li key={date}>
                <button
                  type="button"
                  onClick={() => setBlackouts((prev) => prev.filter((item) => item !== date))}
                  className="px-3 py-1 rounded-full bg-neutral-50 border border-brand-border text-xs"
                >
                  {date} ×
                </button>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-3 bg-brand-text text-white text-sm font-semibold rounded-[10px] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save availability'}
        </button>
      </form>

      <div className="bg-white border border-brand-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-border">
          <h2 className="text-sm font-bold text-brand-text">Upcoming</h2>
        </div>
        {!payload?.bookings.length ? (
          <p className="px-5 py-6 text-sm text-brand-muted">No upcoming consultations.</p>
        ) : (
          <ul>
            {payload.bookings.map((booking) => (
              <li key={booking.id} className="px-5 py-4 border-b border-brand-border last:border-b-0 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div>
                  <p className="text-sm font-semibold text-brand-text">{booking.name}</p>
                  <p className="text-xs text-brand-muted">{booking.business} · {booking.email}</p>
                  <p className="text-xs text-brand-dim mt-1">{booking.whenLabel}</p>
                  {booking.meetLink ? (
                    <a href={booking.meetLink} className="text-xs text-accent font-semibold" target="_blank" rel="noopener noreferrer">
                      Meet link
                    </a>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busyId === booking.id}
                  onClick={() => void cancelBooking(booking.id)}
                  className="text-sm font-semibold text-brand-text border border-brand-border rounded-lg px-3 py-2 disabled:opacity-50"
                >
                  {busyId === booking.id ? 'Cancelling…' : 'Cancel'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
