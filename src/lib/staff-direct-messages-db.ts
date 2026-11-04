import { getSupabase } from './supabase'
import {
  canUseStaffDirectMessages,
  canonicalStaffThreadPair,
  clipStaffPreview,
  compareStaffColleagues,
  normalizeStaffUserId,
  otherStaffParticipant,
  staffDirectSendTarget,
  staffDirectSetupError,
  staffDirectUnread,
  staffDisplayName,
  staffRoleLabel,
  validateStaffDirectText,
  viewerMayReadStaffDirectThread,
} from './staff-direct-messages'

export type StaffColleague = {
  id: string
  name: string
  role: string
  roleLabel: string
  preview: string | null
  previewFromSelf: boolean
  previewAt: string | null
  unread: boolean
}

export type StaffDirectMessage = {
  id: string
  senderId: string
  senderName: string
  text: string
  createdAt: string
}

export type StaffDirectInbox = {
  viewerId: string
  colleagues: StaffColleague[]
}

export type StaffDirectThreadView = {
  viewerId: string
  colleague: { id: string; name: string; role: string; roleLabel: string }
  messages: StaffDirectMessage[]
}

type StoreFailure = { ok: false; status: number; error: string }

type ThreadRow = {
  id: string
  participant_low: string
  participant_high: string
  last_body: string | null
  last_sender_id: string | null
  last_message_at: string | null
}

type UserRow = { id: string; name: string | null; role: string | null }

type MessageRow = {
  id: string
  thread_id: string
  sender_id: string
  body: string
  created_at: string
}

function mapStoreError(error: { code?: string; message?: string } | null, fallback: string): StoreFailure {
  const setup = staffDirectSetupError(error)
  if (setup) return { ok: false, status: 503, error: setup }
  console.error(fallback, error)
  return { ok: false, status: 500, error: fallback }
}

function participantsOf(row: ThreadRow): { participantLow: string; participantHigh: string } {
  return { participantLow: row.participant_low, participantHigh: row.participant_high }
}

async function staffUser(id: string): Promise<{ ok: true; user: UserRow | null } | StoreFailure> {
  const { data, error } = await getSupabase()
    .from('users')
    .select('id, name, role')
    .eq('id', id)
    .maybeSingle()
  if (error) return mapStoreError(error, 'Failed to load staff')
  return { ok: true, user: (data as UserRow | null) ?? null }
}

async function findThread(low: string, high: string): Promise<{ ok: true; thread: ThreadRow | null } | StoreFailure> {
  const { data, error } = await getSupabase()
    .from('staff_direct_threads')
    .select('id, participant_low, participant_high, last_body, last_sender_id, last_message_at')
    .eq('participant_low', low)
    .eq('participant_high', high)
    .maybeSingle()
  if (error) return mapStoreError(error, 'Failed to load the thread')
  return { ok: true, thread: (data as ThreadRow | null) ?? null }
}

async function ensureThread(low: string, high: string): Promise<{ ok: true; thread: ThreadRow } | StoreFailure> {
  const existing = await findThread(low, high)
  if (!existing.ok) return existing
  if (existing.thread) return { ok: true, thread: existing.thread }

  const inserted = await getSupabase()
    .from('staff_direct_threads')
    .insert({ participant_low: low, participant_high: high })
    .select('id, participant_low, participant_high, last_body, last_sender_id, last_message_at')
    .single()

  if (inserted.error) {
    if (inserted.error.code === '23505') {
      const again = await findThread(low, high)
      if (!again.ok) return again
      if (again.thread) return { ok: true, thread: again.thread }
    }
    return mapStoreError(inserted.error, 'Failed to open the thread')
  }
  return { ok: true, thread: inserted.data as ThreadRow }
}

async function markRead(threadId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('staff_direct_reads')
    .upsert(
      { thread_id: threadId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: 'thread_id,user_id' }
    )
  if (error) console.error('staff direct mark read', error)
}

function colleagueFromUser(user: UserRow, thread: ThreadRow | undefined, readAt: string | null, viewerId: string): StaffColleague {
  const preview = thread ? clipStaffPreview(thread.last_body) : null
  const senderId = normalizeStaffUserId(thread?.last_sender_id)
  return {
    id: user.id,
    name: staffDisplayName(user.name),
    role: user.role || '',
    roleLabel: staffRoleLabel(user.role),
    preview,
    previewFromSelf: Boolean(senderId && senderId === viewerId),
    previewAt: thread?.last_message_at ?? null,
    unread: thread
      ? staffDirectUnread({
          viewerId,
          lastSenderId: thread.last_sender_id,
          lastMessageAt: thread.last_message_at,
          lastReadAt: readAt,
        })
      : false,
  }
}

async function requireStaffViewer(viewerId: string): Promise<{ ok: true; id: string } | StoreFailure> {
  const viewer = normalizeStaffUserId(viewerId)
  if (!viewer) return { ok: false, status: 403, error: 'Forbidden' }
  const row = await staffUser(viewer)
  if (!row.ok) return row
  if (!row.user || !canUseStaffDirectMessages(row.user.role)) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }
  return { ok: true, id: viewer }
}

export async function listStaffDirectInbox(viewerId: string): Promise<{ ok: true; inbox: StaffDirectInbox } | StoreFailure> {
  const viewerCheck = await requireStaffViewer(viewerId)
  if (!viewerCheck.ok) return viewerCheck
  const viewer = viewerCheck.id
  const supabase = getSupabase()
  const [usersResult, lowResult, highResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, role')
      .in('role', ['admin', 'credit_manager', 'lead_procurement', 'sales_closer', 'client_relations']),
    supabase
      .from('staff_direct_threads')
      .select('id, participant_low, participant_high, last_body, last_sender_id, last_message_at')
      .eq('participant_low', viewer),
    supabase
      .from('staff_direct_threads')
      .select('id, participant_low, participant_high, last_body, last_sender_id, last_message_at')
      .eq('participant_high', viewer),
  ])

  if (usersResult.error) return mapStoreError(usersResult.error, 'Failed to load staff')
  if (lowResult.error) return mapStoreError(lowResult.error, 'Failed to load messages')
  if (highResult.error) return mapStoreError(highResult.error, 'Failed to load messages')

  const threads = [...((lowResult.data || []) as ThreadRow[]), ...((highResult.data || []) as ThreadRow[])]
  const visible: ThreadRow[] = []
  for (const thread of threads) {
    if (!viewerMayReadStaffDirectThread(viewer, participantsOf(thread))) continue
    if (!otherStaffParticipant(viewer, participantsOf(thread))) continue
    visible.push(thread)
  }

  const readAtByThread = new Map<string, string>()
  if (visible.length > 0) {
    const reads = await supabase
      .from('staff_direct_reads')
      .select('thread_id, last_read_at')
      .eq('user_id', viewer)
      .in('thread_id', visible.map((thread) => thread.id))
    if (reads.error) return mapStoreError(reads.error, 'Failed to load messages')
    for (const row of (reads.data || []) as { thread_id: string; last_read_at: string }[]) {
      readAtByThread.set(row.thread_id, row.last_read_at)
    }
  }

  const threadByOther = new Map<string, ThreadRow>()
  for (const thread of visible) {
    const otherId = otherStaffParticipant(viewer, participantsOf(thread))
    if (otherId) threadByOther.set(otherId, thread)
  }

  const colleagues = ((usersResult.data || []) as UserRow[])
    .filter((user) => normalizeStaffUserId(user.id) !== viewer && canUseStaffDirectMessages(user.role))
    .map((user) => {
      const thread = threadByOther.get(normalizeStaffUserId(user.id) || '')
      return colleagueFromUser(user, thread, thread ? readAtByThread.get(thread.id) ?? null : null, viewer)
    })
    .sort(compareStaffColleagues)

  return { ok: true, inbox: { viewerId: viewer, colleagues } }
}

async function loadMessages(thread: ThreadRow, viewerId: string): Promise<{ ok: true; messages: StaffDirectMessage[] } | StoreFailure> {
  if (!viewerMayReadStaffDirectThread(viewerId, participantsOf(thread))) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  const { data, error } = await getSupabase()
    .from('staff_direct_messages')
    .select('id, thread_id, sender_id, body, created_at')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return mapStoreError(error, 'Failed to load the thread')

  const rows = ((data || []) as MessageRow[]).slice().reverse()
  const senderIds = [...new Set(rows.map((row) => row.sender_id))]
  const names = new Map<string, string>()
  if (senderIds.length > 0) {
    const users = await getSupabase().from('users').select('id, name, role').in('id', senderIds)
    if (users.error) return mapStoreError(users.error, 'Failed to load the thread')
    for (const user of (users.data || []) as UserRow[]) {
      names.set(user.id, staffDisplayName(user.name))
    }
  }

  return {
    ok: true,
    messages: rows.map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      senderName: names.get(row.sender_id) || 'Staff',
      text: row.body,
      createdAt: row.created_at,
    })),
  }
}

export async function getStaffDirectThread(
  viewerId: string,
  otherId: string
): Promise<{ ok: true; thread: StaffDirectThreadView } | StoreFailure> {
  const viewerCheck = await requireStaffViewer(viewerId)
  if (!viewerCheck.ok) return viewerCheck
  const viewer = viewerCheck.id

  const target = staffDirectSendTarget(viewer, otherId)
  if (!target.ok) return target

  const pair = canonicalStaffThreadPair(target.participantLow, target.participantHigh)
  if (!pair || !viewerMayReadStaffDirectThread(viewer, pair)) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  const otherIdNormalized = otherStaffParticipant(viewer, pair)
  if (!otherIdNormalized) return { ok: false, status: 403, error: 'Forbidden' }

  const other = await staffUser(otherIdNormalized)
  if (!other.ok) return other
  if (!other.user || !canUseStaffDirectMessages(other.user.role)) {
    return { ok: false, status: 404, error: 'That person is not on staff.' }
  }

  const found = await findThread(pair.participantLow, pair.participantHigh)
  if (!found.ok) return found

  if (found.thread && !viewerMayReadStaffDirectThread(viewer, participantsOf(found.thread))) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  const loaded = found.thread
    ? await loadMessages(found.thread, viewer)
    : { ok: true as const, messages: [] as StaffDirectMessage[] }
  if (!loaded.ok) return loaded

  if (found.thread) await markRead(found.thread.id, viewer)

  return {
    ok: true,
    thread: {
      viewerId: viewer,
      colleague: {
        id: other.user.id,
        name: staffDisplayName(other.user.name),
        role: other.user.role || '',
        roleLabel: staffRoleLabel(other.user.role),
      },
      messages: loaded.messages,
    },
  }
}

export async function sendStaffDirectMessage(
  viewerId: string,
  otherId: string,
  rawText: unknown
): Promise<{ ok: true; message: StaffDirectMessage; colleagueId: string } | StoreFailure> {
  const textCheck = validateStaffDirectText(rawText)
  if (!textCheck.ok) return textCheck
  const viewerCheck = await requireStaffViewer(viewerId)
  if (!viewerCheck.ok) return viewerCheck
  const viewer = viewerCheck.id
  const target = staffDirectSendTarget(viewer, otherId)
  if (!target.ok) return target

  if (!viewerMayReadStaffDirectThread(viewer, target)) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  const otherIdNormalized = viewer === target.participantLow ? target.participantHigh : target.participantLow
  const [viewerUser, otherUser] = await Promise.all([staffUser(viewer), staffUser(otherIdNormalized)])
  if (!viewerUser.ok) return viewerUser
  if (!otherUser.ok) return otherUser
  if (!viewerUser.user || !canUseStaffDirectMessages(viewerUser.user.role)) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }
  if (!otherUser.user || !canUseStaffDirectMessages(otherUser.user.role)) {
    return { ok: false, status: 404, error: 'That person is not on staff.' }
  }

  const thread = await ensureThread(target.participantLow, target.participantHigh)
  if (!thread.ok) return thread
  if (!viewerMayReadStaffDirectThread(viewer, participantsOf(thread.thread))) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  const inserted = await getSupabase()
    .from('staff_direct_messages')
    .insert({ thread_id: thread.thread.id, sender_id: viewer, body: textCheck.text })
    .select('id, thread_id, sender_id, body, created_at')
    .single()
  if (inserted.error) return mapStoreError(inserted.error, 'Failed to send message')

  await markRead(thread.thread.id, viewer)
  const row = inserted.data as MessageRow
  return {
    ok: true,
    colleagueId: otherUser.user.id,
    message: {
      id: row.id,
      senderId: row.sender_id,
      senderName: staffDisplayName(viewerUser.user.name),
      text: row.body,
      createdAt: row.created_at,
    },
  }
}
