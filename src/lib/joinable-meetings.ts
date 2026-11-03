export type JoinableMeeting = {
  id: string
  prospectId: string
  business: string
  title: string
  startsAt: string
  meetLink: string
}

const JOIN_GRACE_MS = 15 * 60 * 1000

/** A meeting can be joined until 15 minutes after it ends. */
export function meetingStillJoinable(
  input: { startsAt: string; endsAt?: string | null; durationMinutes?: number | null },
  now = Date.now()
): boolean {
  const start = new Date(input.startsAt).getTime()
  if (Number.isNaN(start)) return false
  const duration = input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : 30
  const end = input.endsAt ? new Date(input.endsAt).getTime() : start + duration * 60 * 1000
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
