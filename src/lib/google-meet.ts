import crypto from 'crypto'

/**
 * MVP meet link: unique placeholder admins can replace with a real Google Meet URL.
 *
 * Optional Google Calendar API (future — install googleapis and uncomment calendar integration):
 *   GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_CALENDAR_PRIVATE_KEY  (PEM, \\n escaped in env)
 *   GOOGLE_CALENDAR_ID           (e.g. primary or shared calendar ID)
 *
 * Until Calendar API is wired, admins can paste a link from https://meet.google.com/new
 */
export function generatePlaceholderMeetLink(): string {
  const part = () => crypto.randomBytes(3).toString('hex').slice(0, 3)
  return `https://meet.google.com/${part()}-${part()}-${part().slice(0, 4)}`
}

export async function resolveMeetLinkForMeeting(opts: {
  existingLink?: string
}): Promise<string> {
  if (opts.existingLink?.trim()) return opts.existingLink.trim()
  return generatePlaceholderMeetLink()
}
