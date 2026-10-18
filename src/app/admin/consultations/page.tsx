'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { buildConsultationSlots, isValidTimeZone } from '@/lib/consultation-slots'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const TIMEZONES: Array<[string, string]> = [
  ['America/New_York', 'Eastern — New York'],
  ['America/Chicago', 'Central — Chicago'],
  ['America/Denver', 'Mountain — Denver'],
  ['America/Phoenix', 'Arizona — Phoenix'],
  ['America/Los_Angeles', 'Pacific — Los Angeles'],
  ['America/Anchorage', 'Alaska — Anchorage'],
  ['Pacific/Honolulu', 'Hawaii — Honolulu'],
  ['UTC', 'UTC'],
]

type Hour = { weekday: number; startMinute: number; endMinute: number }
type Booking = {
  id: string
  name: string
  email: string
  phone: string
  business: string
  note: string
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

type Schedule = {
  timezone: string
  slotMinutes: number
  bufferMinutes: number
  windowDays: number
  minLeadMinutes: number
  enabled: boolean[]
  start: string[]
  end: string[]
  blackouts: string[]
}

const fieldClass =
  'mt-1.5 w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-sm text-brand-text'

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

function clockLabel(value: string): string {
  const [hRaw, mRaw] = value.split(':').map(Number)
  if (!Number.isFinite(hRaw) || !Number.isFinite(mRaw)) return value
  const suffix = hRaw >= 12 ? 'PM' : 'AM'
  const hour = hRaw % 12 || 12
  return `${hour}:${String(mRaw).padStart(2, '0')} ${suffix}`
}

function scheduleKey(schedule: Schedule): string {
  return JSON.stringify(schedule)
}

function hoursFrom(enabled: boolean[], start: string[], end: string[]): Hour[] {
  return enabled.flatMap((on, weekday) =>
    on ? [{ weekday, startMinute: fromTime(start[weekday]), endMinute: fromTime(end[weekday]) }] : []
  )
}

function describeHours(enabled: boolean[], start: string[], end: string[]): string {
  const open = WEEKDAYS.map((label, weekday) => ({ label, weekday })).filter((day) => enabled[day.weekday])
  if (!open.length) return 'No days are open.'
  const groups: string[] = []
  let index = 0
  while (index < open.length) {
    const first = open[index]
    const from = start[first.weekday]
    const to = end[first.weekday]
    let last = first
    while (
      index + 1 < open.length &&
      open[index + 1].weekday === last.weekday + 1 &&
      start[open[index + 1].weekday] === from &&
      end[open[index + 1].weekday] === to
    ) {
      index += 1
      last = open[index]
    }
    const span = first.weekday === last.weekday ? first.label : `${first.label}–${last.label}`
    groups.push(`${span}, ${clockLabel(from)}–${clockLabel(to)}`)
    index += 1
  }
  return groups.join('; ')
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
  const [minLeadMinutes, setMinLeadMinutes] = useState(120)
  const [enabled, setEnabled] = useState<boolean[]>(() => WEEKDAYS.map(() => false))
  const [start, setStart] = useState<string[]>(() => WEEKDAYS.map(() => '10:00'))
  const [end, setEnd] = useState<string[]>(() => WEEKDAYS.map(() => '16:00'))
  const [blackouts, setBlackouts] = useState<string[]>([])
  const [blackoutDraft, setBlackoutDraft] = useState('')
  const [busyId, setBusyId] = useState('')
  const [savedKey, setSavedKey] = useState('')

  const schedule: Schedule = {
    timezone,
    slotMinutes,
    bufferMinutes,
    windowDays,
    minLeadMinutes,
    enabled,
    start,
    end,
    blackouts,
  }
  const dirty = savedKey !== '' && scheduleKey(schedule) !== savedKey
  const invalidDay = enabled.findIndex((on, weekday) => on && fromTime(end[weekday]) <= fromTime(start[weekday]))
  const timezoneChoices = TIMEZONES.some(([zone]) => zone === timezone) ? TIMEZONES : [[timezone, timezone] as [string, string], ...TIMEZONES]

  const apply = useCallback((data: Payload) => {
    const nextEnabled = WEEKDAYS.map(() => false)
    const nextStart = WEEKDAYS.map(() => '10:00')
    const nextEnd = WEEKDAYS.map(() => '16:00')
    for (const hour of data.hours) {
      if (hour.weekday < 0 || hour.weekday > 6) continue
      nextEnabled[hour.weekday] = true
      nextStart[hour.weekday] = toTime(hour.startMinute)
      nextEnd[hour.weekday] = toTime(hour.endMinute)
    }
    const next: Schedule = {
      timezone: data.settings.timezone,
      slotMinutes: data.settings.slotMinutes,
      bufferMinutes: data.settings.bufferMinutes,
      windowDays: data.settings.windowDays,
      minLeadMinutes: data.settings.minLeadMinutes,
      enabled: nextEnabled,
      start: nextStart,
      end: nextEnd,
      blackouts: data.blackouts,
    }
    setPayload(data)
    setTimezone(next.timezone)
    setSlotMinutes(next.slotMinutes)
    setBufferMinutes(next.bufferMinutes)
    setWindowDays(next.windowDays)
    setMinLeadMinutes(next.minLeadMinutes)
    setEnabled(next.enabled)
    setStart(next.start)
    setEnd(next.end)
    setBlackouts(next.blackouts)
    setSavedKey(scheduleKey(next))
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

  const previewCount = useMemo(() => {
    if (!isValidTimeZone(timezone) || invalidDay >= 0) return 0
    return buildConsultationSlots({
      now: new Date(),
      settings: { timezone, slotMinutes, bufferMinutes, windowDays, minLeadMinutes },
      hours: hoursFrom(enabled, start, end),
      blackoutDates: blackouts,
      busy: [],
    }).length
  }, [timezone, slotMinutes, bufferMinutes, windowDays, minLeadMinutes, enabled, start, end, blackouts, invalidDay])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (invalidDay >= 0) {
      setError(`${WEEKDAYS[invalidDay]} ends before it starts.`)
      return
    }
    setSaving(true)
    setError('')
    setNote('')
    try {
      const res = await fetch('/api/admin/consultations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone,
          slotMinutes,
          bufferMinutes,
          windowDays,
          minLeadMinutes,
          hours: hoursFrom(enabled, start, end),
          blackouts,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save')
      setNote('Availability saved. Visitors can book these hours now.')
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
    setNote('')
  }

  const cancelBooking = async (id: string, name: string) => {
    if (!window.confirm(`Cancel the consultation with ${name}? The Google Meet is removed and the time opens again.`)) return
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

  const savedOpen = (payload?.hours.length ?? 0) > 0

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-text mb-1">Consultations</h1>
          <p className="text-sm text-brand-muted">
            These hours are what visitors see on the contact page. Each booking creates a Google Meet.
          </p>
        </div>
        <a
          href="/contact#book"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-brand-text border border-brand-border rounded-lg px-3 py-2 w-fit"
        >
          Preview contact page
        </a>
      </div>

      {payload?.calendarConnected ? (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Google Calendar is connected. A saved booking gets a real Meet link.
        </p>
      ) : payload ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Google Calendar is not connected. You can save hours now. Visitors cannot book until the Calendar env vars are set.
        </p>
      ) : null}

      {payload && !savedOpen ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          The contact page has no open times yet. Turn on the days you work, then click Save availability.
        </p>
      ) : null}

      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}
      {note ? <p className="mb-4 text-sm text-brand-text">{note}</p> : null}

      <form onSubmit={save} className="bg-white border border-brand-border rounded-xl p-5 mb-6 space-y-5">
        <div className="rounded-xl bg-neutral-50 border border-brand-border px-4 py-3">
          <p className="text-sm font-semibold text-brand-text">{describeHours(enabled, start, end)}</p>
          <p className="text-xs text-brand-muted mt-1">
            {slotMinutes}-minute visits, {bufferMinutes ? `${bufferMinutes} minutes between them, ` : ''}
            up to {windowDays} days ahead, with {minLeadMinutes} minutes of notice.
            {' '}
            {previewCount === 1 ? '1 open time' : `${previewCount} open times`} before existing bookings are removed.
            {dirty ? ' These edits are not live yet.' : savedOpen ? ' This is what visitors can book.' : ''}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-brand-muted">
            Timezone
            <select
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className={fieldClass}
            >
              {timezoneChoices.map(([zone, label]) => (
                <option key={zone} value={zone}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-brand-muted">
            Appointment length (minutes)
            <input
              type="number"
              min={15}
              max={180}
              value={slotMinutes}
              onChange={(event) => setSlotMinutes(Number(event.target.value))}
              className={fieldClass}
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
              className={fieldClass}
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
              className={fieldClass}
            />
          </label>
          <label className="text-xs font-semibold text-brand-muted sm:col-span-2">
            Minimum notice (minutes)
            <input
              type="number"
              min={0}
              max={10080}
              value={minLeadMinutes}
              onChange={(event) => setMinLeadMinutes(Number(event.target.value))}
              className={fieldClass}
            />
            <span className="mt-1 block font-normal">120 means a visitor cannot book something that starts in the next 2 hours.</span>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-brand-text">Weekly hours</h2>
          <button
            type="button"
            onClick={useWeekdayPreset}
            className="text-sm font-semibold text-brand-text border border-brand-border rounded-lg px-3 py-1.5"
          >
            Fill weekdays 10:00–4:00
          </button>
        </div>
        <div className="space-y-2">
          {WEEKDAYS.map((label, weekday) => (
            <div key={label} className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] items-center gap-2 sm:gap-3 py-1">
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
              {enabled[weekday] ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    aria-label={`${label} start`}
                    value={start[weekday]}
                    onChange={(event) =>
                      setStart((prev) => prev.map((value, index) => (index === weekday ? event.target.value : value)))
                    }
                    className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm"
                  />
                  <span className="text-xs text-brand-dim">to</span>
                  <input
                    type="time"
                    aria-label={`${label} end`}
                    value={end[weekday]}
                    onChange={(event) =>
                      setEnd((prev) => prev.map((value, index) => (index === weekday ? event.target.value : value)))
                    }
                    className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm"
                  />
                </div>
              ) : (
                <span className="text-sm text-brand-dim">Closed</span>
              )}
            </div>
          ))}
        </div>
        {invalidDay >= 0 ? (
          <p className="text-sm text-red-700">{WEEKDAYS[invalidDay]} ends before it starts.</p>
        ) : null}

        <div>
          <h2 className="text-sm font-bold text-brand-text mb-2">Blackout dates</h2>
          <p className="text-xs text-brand-muted mb-3">Closed days stay off the contact page. Click a date to remove it.</p>
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

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="submit"
            disabled={saving || invalidDay >= 0}
            className="px-5 py-3 bg-brand-text text-white text-sm font-semibold rounded-[10px] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save availability'}
          </button>
          {dirty ? <p className="text-sm text-amber-800">Unsaved changes. Visitors still see the last saved hours.</p> : null}
        </div>
      </form>

      <div className="bg-white border border-brand-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-border flex items-center justify-between">
          <h2 className="text-sm font-bold text-brand-text">Upcoming</h2>
          <span className="text-xs text-brand-muted">{payload?.bookings.length ?? 0}</span>
        </div>
        {!payload?.bookings.length ? (
          <p className="px-5 py-6 text-sm text-brand-muted">No upcoming consultations. New bookings from the contact page land here.</p>
        ) : (
          <ul>
            {payload.bookings.map((booking) => (
              <li key={booking.id} className="px-5 py-4 border-b border-brand-border last:border-b-0 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div>
                  <p className="text-sm font-semibold text-brand-text">{booking.name}</p>
                  <p className="text-xs text-brand-muted">
                    {booking.business}
                    {booking.email ? ` · ${booking.email}` : ''}
                    {booking.phone ? ` · ${booking.phone}` : ''}
                  </p>
                  <p className="text-xs text-brand-dim mt-1">{booking.whenLabel}</p>
                  {booking.note ? <p className="text-xs text-brand-muted mt-1">{booking.note}</p> : null}
                  {booking.meetLink ? (
                    <a href={booking.meetLink} className="inline-block mt-2 text-xs text-accent font-semibold" target="_blank" rel="noopener noreferrer">
                      Open Google Meet
                    </a>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busyId === booking.id}
                  onClick={() => void cancelBooking(booking.id, booking.name)}
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
