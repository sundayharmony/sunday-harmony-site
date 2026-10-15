export type ConsultationSettings = {
  timezone: string
  slotMinutes: number
  bufferMinutes: number
  windowDays: number
  minLeadMinutes: number
}

export type WeeklyWindow = {
  weekday: number
  startMinute: number
  endMinute: number
}

export type BusyRange = {
  startsAt: string
  endsAt: string
}

export type ConsultationSlot = {
  startsAt: string
  endsAt: string
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

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

function zonedParts(date: Date, timeZone: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  })
  const bag: Record<string, string> = {}
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') bag[part.type] = part.value
  }
  if (bag.hour === '24') bag.hour = '00'
  return bag
}

export function localDateKey(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function addLocalDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  const y = next.getUTCFullYear()
  const m = String(next.getUTCMonth() + 1).padStart(2, '0')
  const d = String(next.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Convert a wall-clock time in `timeZone` to a UTC instant. */
export function zonedLocalToUtc(dateKey: string, minuteOfDay: number, timeZone: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  const hour = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0)
  for (let i = 0; i < 4; i += 1) {
    const parts = zonedParts(new Date(utc), timeZone)
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second)
    )
    const next = Date.UTC(year, month - 1, day, hour, minute, 0) - (asUtc - utc)
    if (next === utc) break
    utc = next
  }
  return new Date(utc)
}

export function weekdayOfLocalDate(dateKey: string, timeZone: string): number {
  const noon = zonedLocalToUtc(dateKey, 12 * 60, timeZone)
  const label = zonedParts(noon, timeZone).weekday
  const weekday = WEEKDAY_INDEX[label]
  if (weekday == null) throw new Error(`Unknown weekday label: ${label}`)
  return weekday
}

export function formatConsultationWhen(startsAt: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(startsAt)
}

export function formatSlotTime(startsAt: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(startsAt)
}

export function formatSlotDay(startsAt: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(startsAt)
}

export function buildConsultationSlots(input: {
  now: Date
  settings: ConsultationSettings
  hours: WeeklyWindow[]
  blackoutDates: string[]
  busy: BusyRange[]
}): ConsultationSlot[] {
  const { settings } = input
  const blackouts = new Set(input.blackoutDates)
  const earliest = input.now.getTime() + settings.minLeadMinutes * 60_000
  const bufferMs = settings.bufferMinutes * 60_000
  const busy = input.busy.map((range) => ({
    start: new Date(range.startsAt).getTime() - bufferMs,
    end: new Date(range.endsAt).getTime() + bufferMs,
  }))
  const slots: ConsultationSlot[] = []
  let dateKey = localDateKey(input.now, settings.timezone)

  for (let day = 0; day < settings.windowDays; day += 1) {
    if (!blackouts.has(dateKey)) {
      const weekday = weekdayOfLocalDate(dateKey, settings.timezone)
      for (const window of input.hours) {
        if (window.weekday !== weekday) continue
        if (window.endMinute <= window.startMinute) continue
        for (
          let minute = window.startMinute;
          minute + settings.slotMinutes <= window.endMinute;
          minute += settings.slotMinutes
        ) {
          const start = zonedLocalToUtc(dateKey, minute, settings.timezone)
          const end = new Date(start.getTime() + settings.slotMinutes * 60_000)
          if (start.getTime() < earliest) continue
          const blocked = busy.some((range) => start.getTime() < range.end && range.start < end.getTime())
          if (blocked) continue
          slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString() })
        }
      }
    }
    dateKey = addLocalDays(dateKey, 1)
  }

  return slots
}

export function isOpenSlot(startsAt: string, slots: ConsultationSlot[]): ConsultationSlot | null {
  const target = new Date(startsAt).getTime()
  if (!Number.isFinite(target)) return null
  return slots.find((slot) => new Date(slot.startsAt).getTime() === target) ?? null
}

export type ReminderCandidate = {
  status: string
  reminderSentAt: string | null
  confirmationSentAt: string | null
  startsAt: string
  meetLink: string | null
}

const HOUR_MS = 60 * 60 * 1000

/** Meetings in the next 24 hours whose confirmation went out at least 2 hours ago. */
export function bookingsDueForReminder<T extends ReminderCandidate>(rows: T[], now: Date): T[] {
  const nowMs = now.getTime()
  return rows.filter((row) => {
    if (row.status !== 'scheduled' || row.reminderSentAt || !row.confirmationSentAt || !row.meetLink) return false
    const start = new Date(row.startsAt).getTime()
    const confirmed = new Date(row.confirmationSentAt).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(confirmed)) return false
    return start > nowMs && start - nowMs <= 24 * HOUR_MS && nowMs - confirmed >= 2 * HOUR_MS
  })
}
