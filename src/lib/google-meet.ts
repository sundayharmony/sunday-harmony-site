/**
 * Accept a Meet URL an admin pasted. This does not invent a room.
 * Real links come from the Google Calendar API in google-calendar.ts.
 */
export function isSafeHttpsMeetLink(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export async function resolveMeetLinkForMeeting(opts: {
  existingLink?: string | null
}): Promise<string | null> {
  const existing = opts.existingLink?.trim()
  if (existing && isSafeHttpsMeetLink(existing)) return existing
  return null
}
