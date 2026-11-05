export type JoinableMeeting = {
  id: string
  prospectId: string
  business: string
  title: string
  startsAt: string
  endsAt?: string
  durationMinutes?: number
  meetLink: string
  calendarLink?: string
}

export type MeetingProspectRef = {
  id: string
  business: string
  stage?: string
  followUpAt?: string | null
  followUpEventId?: string | null
}

export type CalendarMeetingEvent = {
  id: string
  summary: string
  start: string
  end?: string
  htmlLink?: string
  meetLink?: string
}

export type StoredMeetingRow = {
  id: string
  lead_id?: string | null
  status?: string | null
  scheduled_at: string
  duration_minutes?: number | null
  google_meet_link?: string | null
  title?: string | null
}

export type StoredBookingRow = {
  id: string
  lead_id?: string | null
  starts_at: string
  ends_at?: string | null
  meet_link?: string | null
  business?: string | null
}

const JOIN_GRACE_MS = 15 * 60 * 1000

export function meetingEndMs(
  input: { startsAt: string; endsAt?: string | null; durationMinutes?: number | null }
): number {
  const start = new Date(input.startsAt).getTime()
  if (Number.isNaN(start)) return NaN
  const duration = input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : 30
  const end = input.endsAt ? new Date(input.endsAt).getTime() : start + duration * 60 * 1000
  return Number.isNaN(end) ? NaN : end
}

/** A meeting can be joined until 15 minutes after it ends. */
export function meetingStillJoinable(
  input: { startsAt: string; endsAt?: string | null; durationMinutes?: number | null },
  now = Date.now()
): boolean {
  const start = new Date(input.startsAt).getTime()
  if (Number.isNaN(start)) return false
  const end = meetingEndMs(input)
  if (Number.isNaN(end)) return false
  return end >= now - JOIN_GRACE_MS
}

export function formatMeetingWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

export function safeMeetHref(link: string): string | null {
  try {
    const url = new URL(link)
    if (url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

/** Staff Calendar only shows timed Google Meet bookings, not CRM follow-up reminders. */
export function isGoogleMeetHref(link: string): boolean {
  const href = safeMeetHref(link)
  if (!href) return false
  try {
    const host = new URL(href).hostname.toLowerCase()
    return host === 'meet.google.com' || host.endsWith('.meet.google.com')
  } catch {
    return false
  }
}

function overlapsRange(start: number, end: number, rangeStartMs?: number, rangeEndMs?: number): boolean {
  if (rangeStartMs == null || rangeEndMs == null) return true
  if (Number.isNaN(start) || Number.isNaN(end)) return false
  return start < rangeEndMs && end > rangeStartMs
}

/** Meetings a closer can open: saved Meet links, the sales calendar, and Meeting scheduled deals. */
export function assembleJoinableMeetings(input: {
  prospects: MeetingProspectRef[]
  meetings?: StoredMeetingRow[]
  bookings?: StoredBookingRow[]
  calendarEvents?: CalendarMeetingEvent[]
  includeUnmatchedCalendar?: boolean
  includeEnded?: boolean
  rangeStartMs?: number
  rangeEndMs?: number
  now?: number
}): JoinableMeeting[] {
  const now = input.now ?? Date.now()
  const names = new Map(input.prospects.map((prospect) => [prospect.id, prospect.business]))
  const ids = new Set(names.keys())
  const byEventId = new Map(
    input.prospects
      .filter((prospect) => prospect.followUpEventId)
      .map((prospect) => [prospect.followUpEventId as string, prospect])
  )
  const out: JoinableMeeting[] = []

  function keepTime(
    window: { startsAt: string; endsAt?: string | null; durationMinutes?: number | null }
  ): boolean {
    const start = new Date(window.startsAt).getTime()
    const end = meetingEndMs(window)
    if (!input.includeEnded && !meetingStillJoinable(window, now)) return false
    return overlapsRange(start, end, input.rangeStartMs, input.rangeEndMs)
  }

  function add(row: JoinableMeeting) {
    if (row.prospectId && !ids.has(row.prospectId)) return
    if (!row.prospectId && !input.includeUnmatchedCalendar) return
    const meetLink = safeMeetHref(row.meetLink) || ''
    const calendarLink = safeMeetHref(row.calendarLink || '') || ''
    if (!meetLink && !calendarLink && !row.prospectId) return
    const key = `${row.prospectId}|${meetLink || calendarLink || row.id}`
    const existing = out.find((item) => `${item.prospectId}|${item.meetLink || item.calendarLink || item.id}` === key
      || (row.prospectId && item.prospectId === row.prospectId && item.id === row.id))
    if (existing) {
      if (!existing.meetLink && meetLink) existing.meetLink = meetLink
      if (!existing.calendarLink && calendarLink) existing.calendarLink = calendarLink
      if (!existing.startsAt && row.startsAt) existing.startsAt = row.startsAt
      if (!existing.endsAt && row.endsAt) existing.endsAt = row.endsAt
      return
    }
    out.push({
      ...row,
      meetLink,
      calendarLink: calendarLink || undefined,
      business: row.business || names.get(row.prospectId) || row.title || 'Meeting',
    })
  }

  for (const meeting of input.meetings || []) {
    const prospectId = meeting.lead_id || ''
    if (meeting.status && meeting.status !== 'scheduled') continue
    const window = {
      startsAt: meeting.scheduled_at,
      durationMinutes: meeting.duration_minutes,
    }
    if (!keepTime(window)) continue
    const endsAtMs = meetingEndMs(window)
    add({
      id: meeting.id,
      prospectId,
      business: names.get(prospectId) || meeting.title || 'Meeting',
      title: meeting.title || 'Meeting',
      startsAt: meeting.scheduled_at,
      endsAt: Number.isNaN(endsAtMs) ? undefined : new Date(endsAtMs).toISOString(),
      durationMinutes: meeting.duration_minutes || undefined,
      meetLink: meeting.google_meet_link || '',
    })
  }

  for (const booking of input.bookings || []) {
    const prospectId = booking.lead_id || ''
    const window = { startsAt: booking.starts_at, endsAt: booking.ends_at }
    if (!keepTime(window)) continue
    add({
      id: booking.id,
      prospectId,
      business: names.get(prospectId) || booking.business || 'Consultation',
      title: booking.business ? `Consultation · ${booking.business}` : 'Consultation',
      startsAt: booking.starts_at,
      endsAt: booking.ends_at || undefined,
      meetLink: booking.meet_link || '',
    })
  }

  for (const event of input.calendarEvents || []) {
    if (!event.start) continue
    const window = { startsAt: event.start, endsAt: event.end }
    if (!keepTime(window)) continue
    const matched = byEventId.get(event.id)
    const meetLink = event.meetLink || ''
    const calendarLink = event.htmlLink || ''
    if (!meetLink && !calendarLink) continue
    if (!matched && !(input.includeUnmatchedCalendar && meetLink)) continue
    add({
      id: event.id,
      prospectId: matched?.id || '',
      business: matched?.business || event.summary || 'Meeting',
      title: event.summary || 'Meeting',
      startsAt: event.start,
      endsAt: event.end,
      meetLink,
      calendarLink,
    })
  }

  for (const prospect of input.prospects) {
    const includeFollowUp = prospect.stage === 'meeting_scheduled' || Boolean(input.includeEnded && prospect.followUpAt)
    if (!includeFollowUp) continue
    if (prospect.followUpAt && !keepTime({ startsAt: prospect.followUpAt })) continue
    if (out.some((row) => row.prospectId === prospect.id)) continue
    const event = (input.calendarEvents || []).find((item) => item.id && item.id === prospect.followUpEventId)
    add({
      id: prospect.followUpEventId || prospect.id,
      prospectId: prospect.id,
      business: prospect.business,
      title: `Meeting: ${prospect.business}`,
      startsAt: prospect.followUpAt || event?.start || '',
      endsAt: event?.end,
      meetLink: event?.meetLink || '',
      calendarLink: event?.htmlLink || '',
    })
  }

  out.sort((a, b) => (a.startsAt || '9999').localeCompare(b.startsAt || '9999'))
  return out
}
