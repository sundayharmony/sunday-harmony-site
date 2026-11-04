/** Unread + toast helpers for Credit & Funding applicant messages (staff dashboard). */

export type CfMessageLike = {
  id: string
  from_role: string
  created_at: string
  text?: string
  from_name?: string
}

export const CF_MESSAGE_LAST_READ_PREFIX = 'cf-messages-last-read:'

export function cfMessageLastReadKey(applicationUuid: string): string {
  return `${CF_MESSAGE_LAST_READ_PREFIX}${applicationUuid}`
}

export function getCfMessageLastReadAt(applicationUuid: string): string | null {
  if (typeof window === 'undefined' || !applicationUuid) return null
  try {
    const value = window.localStorage.getItem(cfMessageLastReadKey(applicationUuid))
    return value && value.trim() ? value : null
  } catch {
    return null
  }
}

export function setCfMessageLastReadAt(applicationUuid: string, iso: string): void {
  if (typeof window === 'undefined' || !applicationUuid || !iso) return
  try {
    window.localStorage.setItem(cfMessageLastReadKey(applicationUuid), iso)
  } catch {
    /* ignore quota / private mode */
  }
}

export function markCfMessagesRead(applicationUuid: string, messages: CfMessageLike[]): string {
  let latest: string | null = null
  for (const message of messages) {
    if (!message.created_at) continue
    if (!latest || message.created_at > latest) latest = message.created_at
  }
  const iso = latest || new Date().toISOString()
  setCfMessageLastReadAt(applicationUuid, iso)
  return iso
}

/** Applicant messages newer than the staff last-read watermark. */
export function countUnreadApplicantMessages(
  messages: CfMessageLike[],
  lastReadAt: string | null
): number {
  const applicant = messages.filter((message) => message.from_role === 'applicant')
  if (applicant.length === 0) return 0
  if (!lastReadAt) return applicant.length
  const readMs = new Date(lastReadAt).getTime()
  if (Number.isNaN(readMs)) return applicant.length
  return applicant.filter((message) => {
    const at = new Date(message.created_at).getTime()
    return !Number.isNaN(at) && at > readMs
  }).length
}

export function formatUnreadBadgeCount(count: number): string {
  if (count <= 0) return ''
  if (count > 9) return '9+'
  return String(count)
}

export function clipMessagePreview(text?: string | null, max = 72): string {
  const trimmed = (text || '').replace(/\s+/g, ' ').trim()
  if (!trimmed) return 'New message'
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
}
