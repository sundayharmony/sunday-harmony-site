import { meetingEndMs, safeMeetHref } from '@/lib/joinable-meetings'
import { roleMayOpenProspectFile } from '@/lib/marketing-pipeline'

export const STAFF_CALENDAR_TZ = 'America/New_York'
export const STAFF_CALENDAR_WEEK_START_HOUR = 8
export const STAFF_CALENDAR_WEEK_END_HOUR = 20
export const STAFF_CALENDAR_MAX_RANGE_DAYS = 62

export type StaffCalendarEventKind = 'meeting' | 'todo' | 'google'
export type StaffCalendarSourceStatus = 'ok' | 'error' | 'disconnected' | 'skipped'

export type StaffCalendarEvent = {
  id: string
  kind: StaffCalendarEventKind
  title: string
  start: string
  end?: string
  allDay: boolean
  dateKey: string
  prospectId?: string | null
  todoId?: string | null
  href: string | null
  meetLink?: string
  calendarLink?: string
  muted?: boolean
}

export type CalendarMeetingInput = {
  id: string
  prospectId?: string
  business?: string
  title: string
  startsAt: string
  endsAt?: string
  durationMinutes?: number | null
  meetLink?: string
  calendarLink?: string
}

export type CalendarGoogleInput = {
  id: string
  summary: string
  start: string
  end?: string
  htmlLink?: string
  meetLink?: string
}

export type CalendarTodoInput = {
  id: string
  title: string
  due_date: string | null
  status: string
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

type NyParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: string
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function nyParts(input: Date | string, timeZone = STAFF_CALENDAR_TZ): NyParts | null {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return null
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const named: Record<string, string> = {}
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') named[part.type] = part.value
  }
  return {
    year: Number(named.year),
    month: Number(named.month),
    day: Number(named.day),
    hour: Number(named.hour),
    minute: Number(named.minute),
    second: Number(named.second),
    weekday: named.weekday || '',
  }
}

export function nyDateKey(input: Date | string, timeZone = STAFF_CALENDAR_TZ): string {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input
  const parts = nyParts(input, timeZone)
  if (!parts) return ''
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function instantAtNy(
  dateKey: string,
  hour = 0,
  minute = 0,
  second = 0,
  timeZone = STAFF_CALENDAR_TZ
): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  const wanted = Date.UTC(year, month - 1, day, hour, minute, second)
  let utc = wanted
  for (let pass = 0; pass < 3; pass += 1) {
    const shown = nyParts(new Date(utc), timeZone)
    if (!shown) break
    const shownUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second)
    utc += wanted - shownUtc
  }
  return new Date(utc)
}

export function nyDayStart(dateKey: string): Date {
  return instantAtNy(dateKey, 0, 0, 0)
}

export function nyDayEndExclusive(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  const nextKey = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
  return nyDayStart(nextKey)
}

export function addNyDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

export function nyWeekdayIndex(dateKey: string): number {
  const parts = nyParts(instantAtNy(dateKey, 12, 0))
  if (!parts) return 0
  return WEEKDAY_INDEX[parts.weekday] ?? 0
}

export function startOfNyWeek(dateKey: string): string {
  return addNyDays(dateKey, -nyWeekdayIndex(dateKey))
}

export function startOfNyMonth(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`
}

export function weekDateKeys(anchorKey: string): string[] {
  const start = startOfNyWeek(anchorKey)
  return Array.from({ length: 7 }, (_, index) => addNyDays(start, index))
}

export function monthGridDateKeys(anchorKey: string): string[] {
  const monthStart = startOfNyMonth(anchorKey)
  const gridStart = startOfNyWeek(monthStart)
  return Array.from({ length: 42 }, (_, index) => addNyDays(gridStart, index))
}

export function todayNyDateKey(now = new Date()): string {
  return nyDateKey(now)
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export type CalendarRange = {
  from: Date
  to: Date
  fromKey: string
  toKeyExclusive: string
}

export function parseCalendarRange(
  fromRaw: string | null,
  toRaw: string | null
): { ok: true; range: CalendarRange } | { ok: false; error: string } {
  if (!fromRaw || !toRaw) return { ok: false, error: 'from and to are required' }

  function parseBound(value: string, endExclusive: boolean): Date | null {
    if (isDateOnly(value)) {
      return endExclusive ? nyDayEndExclusive(value) : nyDayStart(value)
    }
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const from = parseBound(fromRaw, false)
  const to = parseBound(toRaw, true)
  if (!from || !to) return { ok: false, error: 'from and to must be dates' }
  if (to.getTime() <= from.getTime()) return { ok: false, error: 'to must be after from' }
  const spanDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)
  if (spanDays > STAFF_CALENDAR_MAX_RANGE_DAYS) {
    return { ok: false, error: `Range cannot exceed ${STAFF_CALENDAR_MAX_RANGE_DAYS} days` }
  }
  return {
    ok: true,
    range: {
      from,
      to,
      fromKey: nyDateKey(from),
      toKeyExclusive: nyDateKey(to),
    },
  }
}

function eventDateKey(start: string): string {
  if (isDateOnly(start)) return start
  return nyDateKey(start)
}

function eventEndIso(row: { startsAt: string; endsAt?: string; durationMinutes?: number | null }): string | undefined {
  if (row.endsAt) return row.endsAt
  const end = meetingEndMs({
    startsAt: row.startsAt,
    durationMinutes: row.durationMinutes,
  })
  return Number.isNaN(end) ? undefined : new Date(end).toISOString()
}

function overlapsRange(startIso: string, endIso: string | undefined, range: CalendarRange): boolean {
  const start = isDateOnly(startIso) ? nyDayStart(startIso).getTime() : new Date(startIso).getTime()
  if (Number.isNaN(start)) return false
  const end = endIso
    ? isDateOnly(endIso)
      ? nyDayStart(endIso).getTime()
      : new Date(endIso).getTime()
    : start + 30 * 60 * 1000
  if (Number.isNaN(end)) return false
  return start < range.to.getTime() && end > range.from.getTime()
}

function meetingHref(input: {
  role?: string | null
  prospectId?: string
  meetLink?: string
  calendarLink?: string
}): string | null {
  if (input.prospectId && roleMayOpenProspectFile(input.role)) {
    return `/admin/pipeline/${input.prospectId}`
  }
  return safeMeetHref(input.meetLink || '') || safeMeetHref(input.calendarLink || '') || null
}

export function meetingToCalendarEvent(
  row: CalendarMeetingInput,
  role?: string | null
): StaffCalendarEvent | null {
  if (!row.startsAt) return null
  const end = eventEndIso(row)
  const meetLink = safeMeetHref(row.meetLink || '') || ''
  const calendarLink = safeMeetHref(row.calendarLink || '') || ''
  const prospectId = row.prospectId && roleMayOpenProspectFile(role) ? row.prospectId : null
  return {
    id: `meeting:${row.id}`,
    kind: 'meeting',
    title: row.business || row.title || 'Meeting',
    start: row.startsAt,
    end,
    allDay: isDateOnly(row.startsAt),
    dateKey: eventDateKey(row.startsAt),
    prospectId,
    href: meetingHref({ role, prospectId: row.prospectId, meetLink, calendarLink }),
    meetLink: meetLink || undefined,
    calendarLink: calendarLink || undefined,
  }
}

export function googleToCalendarEvent(
  row: CalendarGoogleInput,
  role?: string | null
): StaffCalendarEvent | null {
  if (!row.start) return null
  const meetLink = safeMeetHref(row.meetLink || '') || ''
  const calendarLink = safeMeetHref(row.htmlLink || '') || ''
  return {
    id: `google:${row.id}`,
    kind: 'google',
    title: row.summary || 'Calendar event',
    start: row.start,
    end: row.end || undefined,
    allDay: isDateOnly(row.start),
    dateKey: eventDateKey(row.start),
    href: meetingHref({ role, meetLink, calendarLink }),
    meetLink: meetLink || undefined,
    calendarLink: calendarLink || undefined,
  }
}

export function todoToCalendarEvent(row: CalendarTodoInput): StaffCalendarEvent | null {
  if (!row.due_date) return null
  if (row.status === 'done' || row.status === 'cancelled') return null
  const dateKey = nyDateKey(row.due_date)
  if (!dateKey) return null
  return {
    id: `todo:${row.id}`,
    kind: 'todo',
    title: row.title || 'Todo',
    start: dateKey,
    allDay: true,
    dateKey,
    todoId: row.id,
    href: `/admin/todos?todo=${encodeURIComponent(row.id)}`,
    muted: false,
  }
}

function roundStartKey(iso: string): string {
  if (isDateOnly(iso)) return iso
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  date.setUTCSeconds(0, 0)
  date.setUTCMilliseconds(0)
  return date.toISOString()
}

export function dedupeStaffCalendarEvents(events: StaffCalendarEvent[]): StaffCalendarEvent[] {
  const out: StaffCalendarEvent[] = []
  const byId = new Set<string>()
  const byMeet = new Map<string, StaffCalendarEvent>()
  const byStartTitle = new Map<string, StaffCalendarEvent>()

  function mergeInto(existing: StaffCalendarEvent, incoming: StaffCalendarEvent) {
    if (!existing.meetLink && incoming.meetLink) existing.meetLink = incoming.meetLink
    if (!existing.calendarLink && incoming.calendarLink) existing.calendarLink = incoming.calendarLink
    if (!existing.prospectId && incoming.prospectId) existing.prospectId = incoming.prospectId
    if (!existing.href && incoming.href) existing.href = incoming.href
    if (existing.kind === 'google' && incoming.kind === 'meeting') {
      existing.kind = 'meeting'
      existing.id = incoming.id
      existing.title = incoming.title || existing.title
      if (incoming.href) existing.href = incoming.href
    }
  }

  const ranked = events.toSorted((a, b) => {
    const rank = (kind: StaffCalendarEventKind) => (kind === 'meeting' ? 0 : kind === 'todo' ? 1 : 2)
    return rank(a.kind) - rank(b.kind)
  })

  for (const event of ranked) {
    if (byId.has(event.id)) continue
    const meetKey = event.meetLink || ''
    const startKey = `${event.kind === 'todo' ? 'todo' : 'meet'}|${event.prospectId || ''}|${roundStartKey(event.start)}|${event.title.toLowerCase()}`
    const existing =
      (meetKey ? byMeet.get(meetKey) : undefined)
      || (event.kind !== 'todo' ? byStartTitle.get(startKey) : undefined)
    if (existing) {
      mergeInto(existing, event)
      continue
    }
    byId.add(event.id)
    out.push(event)
    if (meetKey) byMeet.set(meetKey, event)
    if (event.kind !== 'todo') byStartTitle.set(startKey, event)
  }

  return out.toSorted((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
    return (a.start || '').localeCompare(b.start || '') || a.title.localeCompare(b.title)
  })
}

export function mergeStaffCalendarEvents(input: {
  meetings?: CalendarMeetingInput[]
  googleEvents?: CalendarGoogleInput[]
  todos?: CalendarTodoInput[]
  role?: string | null
  range: CalendarRange
}): StaffCalendarEvent[] {
  const events: StaffCalendarEvent[] = []
  for (const meeting of input.meetings || []) {
    const mapped = meetingToCalendarEvent(meeting, input.role)
    if (mapped && overlapsRange(mapped.start, mapped.end, input.range)) events.push(mapped)
  }
  for (const event of input.googleEvents || []) {
    const mapped = googleToCalendarEvent(event, input.role)
    if (mapped && overlapsRange(mapped.start, mapped.end, input.range)) events.push(mapped)
  }
  for (const todo of input.todos || []) {
    const mapped = todoToCalendarEvent(todo)
    if (!mapped) continue
    const start = nyDayStart(mapped.dateKey).toISOString()
    const end = nyDayEndExclusive(mapped.dateKey).toISOString()
    if (overlapsRange(start, end, input.range)) events.push(mapped)
  }
  return dedupeStaffCalendarEvents(events)
}

export function eventsOnDate(events: StaffCalendarEvent[], dateKey: string): StaffCalendarEvent[] {
  return events.filter((event) => {
    if (event.allDay) return event.dateKey === dateKey
    const startKey = eventDateKey(event.start)
    if (startKey === dateKey) return true
    if (!event.end) return false
    const start = isDateOnly(event.start) ? nyDayStart(event.start).getTime() : new Date(event.start).getTime()
    const end = isDateOnly(event.end) ? nyDayStart(event.end).getTime() : new Date(event.end).getTime()
    const dayStart = nyDayStart(dateKey).getTime()
    const dayEnd = nyDayEndExclusive(dateKey).getTime()
    return start < dayEnd && end > dayStart
  })
}

export function timedBlockPercent(
  event: StaffCalendarEvent,
  dateKey: string
): { top: number; height: number } | null {
  if (event.allDay || isDateOnly(event.start)) return null
  const parts = nyParts(event.start)
  if (!parts || nyDateKey(event.start) !== dateKey) {
    if (!event.end) return null
  }
  const dayStart = instantAtNy(dateKey, STAFF_CALENDAR_WEEK_START_HOUR, 0).getTime()
  const dayEnd = instantAtNy(dateKey, STAFF_CALENDAR_WEEK_END_HOUR, 0).getTime()
  const span = dayEnd - dayStart
  if (span <= 0) return null
  const start = new Date(event.start).getTime()
  const end = event.end ? new Date(event.end).getTime() : start + 30 * 60 * 1000
  const clampedStart = Math.min(Math.max(start, dayStart), dayEnd)
  const clampedEnd = Math.min(Math.max(end, dayStart + 15 * 60 * 1000), dayEnd)
  if (clampedEnd <= dayStart || clampedStart >= dayEnd) return null
  const top = ((clampedStart - dayStart) / span) * 100
  const height = Math.max(((clampedEnd - clampedStart) / span) * 100, 4)
  return { top, height }
}

export function hourLabels(): number[] {
  const hours: number[] = []
  for (let hour = STAFF_CALENDAR_WEEK_START_HOUR; hour < STAFF_CALENDAR_WEEK_END_HOUR; hour += 1) {
    hours.push(hour)
  }
  return hours
}

export function formatNyTime(iso: string): string {
  if (isDateOnly(iso)) return 'All day'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', {
    timeZone: STAFF_CALENDAR_TZ,
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatNyDayHeading(dateKey: string): string {
  const date = instantAtNy(dateKey, 12, 0)
  return date.toLocaleString('en-US', {
    timeZone: STAFF_CALENDAR_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatNyMonthHeading(dateKey: string): string {
  const date = instantAtNy(`${dateKey.slice(0, 7)}-01`, 12, 0)
  return date.toLocaleString('en-US', {
    timeZone: STAFF_CALENDAR_TZ,
    month: 'long',
    year: 'numeric',
  })
}

export function formatNyWeekHeading(dateKeys: string[]): string {
  if (dateKeys.length === 0) return ''
  const first = instantAtNy(dateKeys[0], 12, 0)
  const last = instantAtNy(dateKeys[dateKeys.length - 1], 12, 0)
  const startLabel = first.toLocaleString('en-US', { timeZone: STAFF_CALENDAR_TZ, month: 'short', day: 'numeric' })
  const endLabel = last.toLocaleString('en-US', {
    timeZone: STAFF_CALENDAR_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${startLabel} – ${endLabel}`
}
