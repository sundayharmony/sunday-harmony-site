import { isStaffRole } from './staff-roles'
import { isUuid } from './uuid'

/** Internal staff who can open /admin/messages. Clients and partners cannot. */
export function canUseStaffDirectMessages(role?: string | null): boolean {
  return isStaffRole(role)
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  credit_manager: 'Credit expert',
  lead_procurement: 'Lead procurement',
  sales_closer: 'Sales closer',
  client_relations: 'Client relations',
}

export function staffRoleLabel(role?: string | null): string {
  if (!role) return 'Staff'
  return ROLE_LABELS[role] || 'Staff'
}

export function staffDisplayName(name?: string | null): string {
  const trimmed = (name || '').trim()
  return trimmed || 'Staff'
}

export const STAFF_MESSAGE_TIME_ZONE = 'America/New_York'

export const STAFF_DIRECT_SETUP_ERROR =
  'Staff messages are not set up yet. Run supabase-migration-050-staff-messages.sql in the Supabase SQL Editor, then try again.'

export function formatStaffMessageTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', {
    timeZone: STAFF_MESSAGE_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function normalizeStaffUserId(value?: string | null): string | null {
  const id = (value || '').trim().toLowerCase()
  return isUuid(id) ? id : null
}

/** One row per pair. The same two people always land on the same thread. */
export function canonicalStaffThreadPair(
  a?: string | null,
  b?: string | null
): { participantLow: string; participantHigh: string } | null {
  const left = normalizeStaffUserId(a)
  const right = normalizeStaffUserId(b)
  if (!left || !right || left === right) return null
  return left < right
    ? { participantLow: left, participantHigh: right }
    : { participantLow: right, participantHigh: left }
}

export function viewerMayReadStaffDirectThread(
  viewerId?: string | null,
  thread?: { participantLow: string; participantHigh: string } | null
): boolean {
  const viewer = normalizeStaffUserId(viewerId)
  if (!viewer || !thread) return false
  const low = normalizeStaffUserId(thread.participantLow)
  const high = normalizeStaffUserId(thread.participantHigh)
  if (!low || !high) return false
  return viewer === low || viewer === high
}

/** The other person in a thread, or null when the viewer is not a member. */
export function otherStaffParticipant(
  viewerId?: string | null,
  thread?: { participantLow: string; participantHigh: string } | null
): string | null {
  if (!viewerMayReadStaffDirectThread(viewerId, thread) || !thread) return null
  const viewer = normalizeStaffUserId(viewerId)
  const low = normalizeStaffUserId(thread.participantLow)
  const high = normalizeStaffUserId(thread.participantHigh)
  if (!viewer || !low || !high) return null
  return viewer === low ? high : low
}

export function staffDirectSendTarget(
  viewerId?: string | null,
  otherId?: string | null
):
  | { ok: true; participantLow: string; participantHigh: string }
  | { ok: false; status: 400; error: string } {
  const viewer = normalizeStaffUserId(viewerId)
  const other = normalizeStaffUserId(otherId)
  if (viewer && other && viewer === other) {
    return { ok: false, status: 400, error: 'Choose someone else on staff.' }
  }
  const pair = canonicalStaffThreadPair(viewer, other)
  if (!pair) return { ok: false, status: 400, error: 'Choose a teammate.' }
  return { ok: true, ...pair }
}

export function staffDirectUnread(input: {
  viewerId: string
  lastSenderId?: string | null
  lastMessageAt?: string | null
  lastReadAt?: string | null
}): boolean {
  const viewer = normalizeStaffUserId(input.viewerId)
  const sender = normalizeStaffUserId(input.lastSenderId)
  if (!viewer || !sender || !input.lastMessageAt || sender === viewer) return false
  if (!input.lastReadAt) return true
  const messageAt = new Date(input.lastMessageAt).getTime()
  const readAt = new Date(input.lastReadAt).getTime()
  if (Number.isNaN(messageAt) || Number.isNaN(readAt)) return false
  return messageAt > readAt
}

export function clipStaffPreview(text?: string | null, max = 80): string | null {
  const trimmed = (text || '').replace(/\s+/g, ' ').trim()
  if (!trimmed) return null
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
}

export function compareStaffColleagues(
  a: { name: string; unread: boolean },
  b: { name: string; unread: boolean }
): number {
  if (a.unread !== b.unread) return a.unread ? -1 : 1
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

export function staffDirectSetupError(
  error?: { code?: string; message?: string } | string | null
): string | null {
  if (!error) return null
  const code = typeof error === 'string' ? '' : error.code || ''
  const message = typeof error === 'string' ? error : error.message || ''
  const blob = `${code} ${message}`
  if (code === '42P01' || code === 'PGRST205') return STAFF_DIRECT_SETUP_ERROR
  if (/42P01|PGRST205/i.test(blob)) return STAFF_DIRECT_SETUP_ERROR
  if (/relation ["']?staff_direct_(threads|messages|reads)["']? does not exist/i.test(blob)) {
    return STAFF_DIRECT_SETUP_ERROR
  }
  if (/could not find the table ['"]public\.staff_direct_(threads|messages|reads)['"]/i.test(blob)) {
    return STAFF_DIRECT_SETUP_ERROR
  }
  if (/column ["']?staff_direct_threads\.(last_body|last_sender_id|last_message_at)["']? does not exist/i.test(blob)) {
    return STAFF_DIRECT_SETUP_ERROR
  }
  return null
}

export const STAFF_DIRECT_TEXT_MAX = 10000

export function validateStaffDirectText(
  value: unknown
): { ok: true; text: string } | { ok: false; status: 400; error: string } {
  if (typeof value !== 'string') {
    return { ok: false, status: 400, error: 'Message is required.' }
  }
  const text = value.trim()
  if (!text) return { ok: false, status: 400, error: 'Message is required.' }
  if (text.length > STAFF_DIRECT_TEXT_MAX) {
    return { ok: false, status: 400, error: 'Message is too long (max 10000 characters).' }
  }
  return { ok: true, text }
}
