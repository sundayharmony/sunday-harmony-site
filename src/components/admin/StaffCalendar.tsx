'use client'

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import {
  addNyDays,
  eventsOnDate,
  formatNyDayHeading,
  formatNyMonthHeading,
  formatNyTime,
  formatNyWeekHeading,
  hourLabels,
  monthGridDateKeys,
  startOfNyMonth,
  startOfNyWeek,
  timedBlockPercent,
  todayNyDateKey,
  weekDateKeys,
  type StaffCalendarEvent,
  type StaffCalendarSourceStatus,
} from '@/lib/staff-calendar'

type CalendarView = 'week' | 'month'

type CalendarPayload = {
  timezone?: string
  workspaceConnected?: boolean
  events?: StaffCalendarEvent[]
  sources?: {
    meetings?: StaffCalendarSourceStatus
    todos?: StaffCalendarSourceStatus
    google?: StaffCalendarSourceStatus
  }
  error?: string
}

const hours = hourLabels()
const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function kindClass(kind: StaffCalendarEvent['kind']): string {
  if (kind === 'todo') return 'bg-accent-soft text-brand-text border-accent/40'
  if (kind === 'meeting') return 'bg-brand-text text-white border-brand-text'
  return 'bg-white text-brand-text border-brand-border'
}

function EventLink({
  event,
  className,
  style,
  children,
}: {
  event: StaffCalendarEvent
  className: string
  style?: CSSProperties
  children: ReactNode
}) {
  if (!event.href) {
    return <div className={className} style={style}>{children}</div>
  }
  if (event.href.startsWith('/')) {
    return (
      <Link href={event.href} className={className} style={style}>
        {children}
      </Link>
    )
  }
  return (
    <a href={event.href} target="_blank" rel="noreferrer" className={className} style={style}>
      {children}
    </a>
  )
}

function AgendaList({
  dateKeys,
  events,
  selectedKey,
  empty,
}: {
  dateKeys: string[]
  events: StaffCalendarEvent[]
  selectedKey?: string
  empty: string
}) {
  const days = dateKeys.map((dateKey) => ({ dateKey, items: eventsOnDate(events, dateKey) }))
  const hasAny = days.some((day) => day.items.length > 0)
  if (!hasAny) {
    return <p className="text-sm text-brand-muted px-1 py-6">{empty}</p>
  }
  return (
    <ol className="space-y-4">
      {days.map((day) => (
        <li key={day.dateKey} className={day.dateKey === selectedKey ? 'rounded-xl bg-accent-soft/40 p-3' : ''}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-muted mb-2">
            {formatNyDayHeading(day.dateKey)}
          </h3>
          {day.items.length === 0 ? (
            <p className="text-sm text-brand-muted">Nothing due today</p>
          ) : (
            <ul className="space-y-2">
              {day.items.map((event) => (
                <li key={event.id}>
                  <EventLink
                    event={event}
                    className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${kindClass(event.kind)}`}
                  >
                    <span className="text-xs font-semibold tabular-nums shrink-0 w-16">
                      {event.allDay ? 'All day' : formatNyTime(event.start)}
                    </span>
                    <span className="text-sm font-medium min-w-0 break-words">{event.title}</span>
                  </EventLink>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  )
}

function WeekGrid({
  dateKeys,
  events,
  todayKey,
}: {
  dateKeys: string[]
  events: StaffCalendarEvent[]
  todayKey: string
}) {
  return (
    <div className="overflow-x-auto" data-testid="calendar-week">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-px bg-brand-border rounded-t-xl overflow-hidden">
          <div className="bg-white" />
          {dateKeys.map((dateKey) => {
            const dayEvents = eventsOnDate(events, dateKey)
            const allDay = dayEvents.filter((event) => event.allDay)
            return (
              <div
                key={`head-${dateKey}`}
                className={`bg-white px-2 py-2 ${dateKey === todayKey ? 'bg-accent-soft/50' : ''}`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                  {formatNyDayHeading(dateKey)}
                </p>
                <div className="mt-1 space-y-1 min-h-[1.5rem]">
                  {allDay.length === 0 ? (
                    dayEvents.some((event) => !event.allDay) ? null : (
                      <p className="text-[11px] text-brand-muted">Nothing due today</p>
                    )
                  ) : (
                    allDay.map((event) => (
                      <EventLink
                        key={event.id}
                        event={event}
                        className={`block rounded-md border px-1.5 py-0.5 text-[11px] font-medium truncate ${kindClass(event.kind)}`}
                      >
                        {event.title}
                      </EventLink>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-px bg-brand-border rounded-b-xl overflow-hidden">
          <div className="bg-white">
            {hours.map((hour) => (
              <div key={hour} className="h-12 border-b border-brand-border/70 px-1 text-[10px] text-brand-muted">
                {hour === 12 ? '12 pm' : hour > 12 ? `${hour - 12} pm` : `${hour} am`}
              </div>
            ))}
          </div>
          {dateKeys.map((dateKey) => {
            const timed = eventsOnDate(events, dateKey).filter((event) => !event.allDay)
            return (
              <div key={`col-${dateKey}`} className="relative bg-white">
                {hours.map((hour) => (
                  <div key={hour} className="h-12 border-b border-brand-border/70" />
                ))}
                {timed.map((event) => {
                  const box = timedBlockPercent(event, dateKey)
                  if (!box) return null
                  return (
                    <EventLink
                      key={event.id}
                      event={event}
                      style={{ top: `${box.top}%`, height: `${box.height}%` }}
                      className={`absolute left-1 right-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium overflow-hidden ${kindClass(event.kind)}`}
                    >
                      <span className="block truncate">{event.title}</span>
                      <span className="block opacity-80">{formatNyTime(event.start)}</span>
                    </EventLink>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MonthGrid({
  dateKeys,
  events,
  monthKey,
  selectedKey,
  todayKey,
  onSelect,
}: {
  dateKeys: string[]
  events: StaffCalendarEvent[]
  monthKey: string
  selectedKey: string
  todayKey: string
  onSelect: (dateKey: string) => void
}) {
  const monthPrefix = monthKey.slice(0, 7)
  return (
    <div data-testid="calendar-month">
      <div className="grid grid-cols-7 gap-px bg-brand-border rounded-xl overflow-hidden">
        {weekdayLabels.map((label) => (
          <div key={label} className="bg-white px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
            {label}
          </div>
        ))}
        {dateKeys.map((dateKey) => {
          const inMonth = dateKey.startsWith(monthPrefix)
          const items = eventsOnDate(events, dateKey)
          const selected = dateKey === selectedKey
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelect(dateKey)}
              aria-pressed={selected}
              aria-label={formatNyDayHeading(dateKey)}
              className={`min-h-[6.5rem] bg-white p-1.5 text-left align-top ${
                selected ? 'ring-2 ring-inset ring-accent' : ''
              } ${dateKey === todayKey ? 'bg-accent-soft/40' : ''} ${inMonth ? '' : 'opacity-50'}`}
            >
              <span className="text-xs font-semibold text-brand-text">{Number(dateKey.slice(8))}</span>
              <span className="mt-1 block space-y-1">
                {items.slice(0, 3).map((event) => (
                  <span
                    key={event.id}
                    className={`block truncate rounded px-1 py-0.5 text-[10px] font-medium border ${kindClass(event.kind)}`}
                  >
                    {event.title}
                  </span>
                ))}
                {items.length > 3 ? (
                  <span className="block text-[10px] text-brand-muted">+{items.length - 3} more</span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function StaffCalendar() {
  const todayKey = todayNyDateKey()
  const [view, setView] = useState<CalendarView>('week')
  const [anchorKey, setAnchorKey] = useState(todayKey)
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState<CalendarPayload | null>(null)

  const dateKeys = useMemo(
    () => (view === 'week' ? weekDateKeys(anchorKey) : monthGridDateKeys(anchorKey)),
    [anchorKey, view]
  )
  const from = dateKeys[0]
  const to = dateKeys[dateKeys.length - 1]

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const res = await fetch(`/api/admin/calendar?from=${from}&to=${to}`, { signal: controller.signal })
        const data = (await res.json().catch(() => ({}))) as CalendarPayload
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Could not load the calendar.')
          setPayload(null)
          return
        }
        setPayload(data)
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Could not load the calendar.')
        setPayload(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [from, to])

  const events = payload?.events || []
  const heading = view === 'week' ? formatNyWeekHeading(dateKeys) : formatNyMonthHeading(anchorKey)
  const empty = view === 'week' ? 'No meetings this week' : 'Nothing due today'

  function shift(by: number) {
    const next = view === 'week' ? addNyDays(startOfNyWeek(anchorKey), by * 7) : addNyDays(startOfNyMonth(anchorKey), by * 32)
    const normalized = view === 'week' ? startOfNyWeek(next) : startOfNyMonth(next)
    setAnchorKey(normalized)
    if (view === 'month') setSelectedKey(normalized)
  }

  function goToday() {
    setAnchorKey(todayKey)
    setSelectedKey(todayKey)
  }

  function changeView(next: CalendarView) {
    setView(next)
    if (next === 'week') setAnchorKey(startOfNyWeek(selectedKey || todayKey))
    else setAnchorKey(startOfNyMonth(selectedKey || todayKey))
  }

  const sourceNote = payload?.sources?.google === 'disconnected'
    ? 'Google Calendar is not connected. Meetings and todos still show here.'
    : payload?.sources?.google === 'error'
      ? 'Google Calendar could not be loaded. Meetings and todos still show here.'
      : payload?.sources?.meetings === 'error'
        ? 'Some meetings could not be loaded.'
        : payload?.sources?.todos === 'error'
          ? 'Some todos could not be loaded.'
          : ''

  return (
    <div className="space-y-5" aria-busy={loading}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text">Calendar</h1>
          <p className="text-sm text-brand-muted mt-1">{heading} · America/New_York</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-lg border border-brand-border bg-white p-1">
            <button
              type="button"
              onClick={() => changeView('week')}
              className={`px-3 py-1.5 text-sm font-semibold rounded-md ${
                view === 'week' ? 'bg-accent-soft text-accent' : 'text-brand-muted'
              }`}
              aria-pressed={view === 'week'}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => changeView('month')}
              className={`px-3 py-1.5 text-sm font-semibold rounded-md ${
                view === 'month' ? 'bg-accent-soft text-accent' : 'text-brand-muted'
              }`}
              aria-pressed={view === 'month'}
            >
              Month
            </button>
          </div>
          <button
            type="button"
            onClick={() => shift(-1)}
            className="px-3 py-2 text-sm font-semibold rounded-lg border border-brand-border bg-white"
            aria-label={view === 'week' ? 'Previous week' : 'Previous month'}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={goToday}
            className="px-3 py-2 text-sm font-semibold rounded-lg border border-brand-border bg-white"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="px-3 py-2 text-sm font-semibold rounded-lg border border-brand-border bg-white"
            aria-label={view === 'week' ? 'Next week' : 'Next month'}
          >
            Next
          </button>
        </div>
      </div>

      {sourceNote ? (
        <p className="text-sm text-brand-muted bg-white border border-brand-border rounded-lg px-3 py-2">{sourceNote}</p>
      ) : null}
      {error ? <p className="text-sm text-brand-red" role="alert">{error}</p> : null}
      {loading ? <p className="text-sm text-brand-muted" role="status">Loading calendar…</p> : null}

      {!loading && !error ? (
        <>
          <div className="hidden sm:block">
            {view === 'week' ? (
              events.length === 0 ? (
                <p className="text-sm text-brand-muted py-8">{empty}</p>
              ) : (
                <WeekGrid dateKeys={dateKeys} events={events} todayKey={todayKey} />
              )
            ) : (
              <div className="space-y-4">
                <MonthGrid
                  dateKeys={dateKeys}
                  events={events}
                  monthKey={anchorKey}
                  selectedKey={selectedKey}
                  todayKey={todayKey}
                  onSelect={setSelectedKey}
                />
                <AgendaList dateKeys={[selectedKey]} events={events} selectedKey={selectedKey} empty={empty} />
              </div>
            )}
          </div>
          <div className="sm:hidden space-y-4" data-testid="calendar-agenda">
            {view === 'month' ? (
              <>
                <div className="grid grid-cols-7 gap-1" data-testid="calendar-month-phone">
                  {weekdayLabels.map((label) => (
                    <div key={label} className="text-[10px] font-semibold uppercase text-brand-muted text-center">
                      {label}
                    </div>
                  ))}
                  {dateKeys.map((dateKey) => {
                    const count = eventsOnDate(events, dateKey).length
                    const inMonth = dateKey.startsWith(anchorKey.slice(0, 7))
                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => setSelectedKey(dateKey)}
                        aria-pressed={dateKey === selectedKey}
                        aria-label={formatNyDayHeading(dateKey)}
                        className={`h-10 rounded-lg text-sm ${
                          dateKey === selectedKey ? 'bg-brand-text text-white' : 'bg-white border border-brand-border'
                        } ${inMonth ? '' : 'opacity-40'}`}
                      >
                        {Number(dateKey.slice(8))}
                        {count > 0 ? <span className="block mx-auto mt-0.5 h-1 w-1 rounded-full bg-accent" /> : null}
                      </button>
                    )
                  })}
                </div>
                <AgendaList dateKeys={[selectedKey]} events={events} selectedKey={selectedKey} empty={empty} />
              </>
            ) : (
              <AgendaList dateKeys={dateKeys} events={events} empty={empty} />
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
