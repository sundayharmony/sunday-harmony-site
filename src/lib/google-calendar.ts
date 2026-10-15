export type CreatedMeetEvent = {
  eventId: string
  meetLink: string
}

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_CALENDAR_REFRESH_TOKEN?.trim() &&
      process.env.GOOGLE_CALENDAR_ID?.trim()
  )
}

function calendarEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not set`)
  return value
}

async function getAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: calendarEnv('GOOGLE_CALENDAR_CLIENT_ID'),
    client_secret: calendarEnv('GOOGLE_CALENDAR_CLIENT_SECRET'),
    refresh_token: calendarEnv('GOOGLE_CALENDAR_REFRESH_TOKEN'),
    grant_type: 'refresh_token',
  })
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const payload = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string }
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error || 'Google token refresh failed')
  }
  return payload.access_token
}

function meetLinkFromEvent(payload: {
  hangoutLink?: string
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> }
}): string | null {
  if (payload.hangoutLink && payload.hangoutLink.startsWith('https://')) return payload.hangoutLink
  const video = payload.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video' && entry.uri)
  if (video?.uri?.startsWith('https://')) return video.uri
  return null
}

export async function createMeetEvent(opts: {
  summary: string
  description: string
  startsAt: Date
  endsAt: Date
  attendeeEmail: string
  timeZone: string
}): Promise<CreatedMeetEvent> {
  const token = await getAccessToken()
  const calendarId = encodeURIComponent(calendarEnv('GOOGLE_CALENDAR_ID'))
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1&sendUpdates=none`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: opts.summary,
        description: opts.description,
        start: { dateTime: opts.startsAt.toISOString(), timeZone: opts.timeZone },
        end: { dateTime: opts.endsAt.toISOString(), timeZone: opts.timeZone },
        attendees: [{ email: opts.attendeeEmail }],
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }),
    }
  )
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string
    hangoutLink?: string
    error?: { message?: string }
    conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> }
  }
  const meetLink = meetLinkFromEvent(payload)
  if (!response.ok || !payload.id || !meetLink) {
    throw new Error(payload.error?.message || 'Google Calendar did not return a Meet link')
  }
  return { eventId: payload.id, meetLink }
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  if (!eventId.trim() || !isGoogleCalendarConfigured()) return
  const token = await getAccessToken()
  const calendarId = encodeURIComponent(calendarEnv('GOOGLE_CALENDAR_ID'))
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(payload.error?.message || 'Could not delete the calendar event')
  }
}
