import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import {
  CLIENT_FILE_MAX_BYTES,
  downloadClientFileBytes,
  resolveClientFileStoragePathForClient,
  uploadClientFileToVault,
} from '@/lib/client-files-storage'
import {
  createMessage,
  createNotification,
  getClientById,
  getFileById,
  getMessageById,
} from '@/lib/db'
import {
  getGoogleAccessToken,
  isGoogleWorkspaceConfigured,
  workspaceMailbox,
} from '@/lib/google-workspace'
import { isStaffRole } from '@/lib/staff-roles'
import { getSupabase } from '@/lib/supabase'
import {
  getAdminNotifyEmail,
  isEmailConfigured,
  sendEmail,
} from '@/lib/smtp-mail'
import { rateLimitDurable } from '@/lib/rate-limit-durable'
import {
  attachmentContentDisposition,
  attachmentMediaType,
  collectGmailContent,
  decideInboundReply,
  decodeGmailBytes,
  headerValue,
  mailDateIso,
  portalRefFromSubject,
  portalSubject,
  publicMessage,
  safeObjectPath,
  storedAttachments,
  type GmailPart,
  type MailHeader,
  type PublicMessage,
  type StoredAttachment,
} from '@/lib/portal-message-mail'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const SETUP_ERROR =
  'Message attachments are not set up yet. Run supabase-migration-058-portal-message-attachments.sql in the Supabase SQL Editor.'

function missingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42703' || error.code === 'PGRST204') return true
  return /attachments|gmail_message_id/i.test(error.message || '')
}

export function portalReplyToAddress(): string {
  if (isGoogleWorkspaceConfigured()) return workspaceMailbox()
  const from = process.env.SMTP_FROM_EMAIL?.trim() || process.env.SMTP_USER?.trim() || getAdminNotifyEmail()
  const match = from.match(/<([^>]+)>/)
  return (match ? match[1] : from).trim()
}

export async function notifyClientOfPortalMessage(clientId: string, text: string): Promise<void> {
  const { data: clientUser } = await getSupabase().from('users').select('id').eq('client_id', clientId).maybeSingle()
  if (!clientUser?.id) return
  await createNotification({
    user_id: clientUser.id,
    title: 'New Message',
    message: text.slice(0, 50),
    type: 'message',
    link: '/dashboard/messages',
  })
}

export async function resolveThreadAttachment(
  clientId: string,
  fileId: unknown
): Promise<{ ok: true; attachment: StoredAttachment | null } | { ok: false; error: string }> {
  if (fileId == null || fileId === '') return { ok: true, attachment: null }
  if (typeof fileId !== 'string' || !/^[0-9a-f-]{36}$/i.test(fileId)) {
    return { ok: false, error: 'Attachment not found' }
  }
  const file = await getFileById(fileId)
  const resolved = file && file.client_id === clientId
    ? resolveClientFileStoragePathForClient(file.file_url, clientId)
    : null
  const path = resolved ? safeObjectPath(resolved, clientId) : null
  if (!file || file.client_id !== clientId || !path) {
    return { ok: false, error: 'Attachment not found' }
  }
  return {
    ok: true,
    attachment: {
      id: randomUUID(),
      name: file.name.slice(0, 300),
      path,
      type: file.file_type || '',
      size: file.file_size || 0,
      fileId: file.id,
    },
  }
}

export async function savePortalMessage(input: {
  clientId: string
  fromRole: 'admin' | 'client'
  fromName: string
  text: unknown
  fileId: unknown
}): Promise<
  | { ok: true; message: PublicMessage; attachment: StoredAttachment | null }
  | { ok: false; status: number; error: string }
> {
  const text = typeof input.text === 'string' ? input.text.trim() : ''
  if (text.length > 10000) {
    return { ok: false, status: 400, error: 'Message is too long (max 10000 characters)' }
  }
  const attached = await resolveThreadAttachment(input.clientId, input.fileId)
  if (!attached.ok) return { ok: false, status: 400, error: attached.error }
  if (!text && !attached.attachment) {
    return { ok: false, status: 400, error: 'Message text required' }
  }

  const saved = await createMessage({
    client_id: input.clientId,
    from_role: input.fromRole,
    from_name: input.fromName,
    text: text || attached.attachment!.name,
    attachments: attached.attachment ? [attached.attachment] : undefined,
  })
  if (!saved.ok) {
    return {
      ok: false,
      status: saved.missingColumn ? 503 : 500,
      error: saved.missingColumn ? SETUP_ERROR : 'Failed to send message',
    }
  }
  return { ok: true, message: publicMessage(saved.message), attachment: attached.attachment }
}

export function queuePortalThreadEmail(opts: {
  to: string
  subjectBase: string
  clientId: string
  html: string
  attachment?: StoredAttachment | null
}): void {
  if (!isEmailConfigured() || !opts.to) return
  void deliverPortalThreadEmail(opts).catch((error: unknown) => console.error('portal thread mail', error))
}

async function deliverPortalThreadEmail(opts: {
  to: string
  subjectBase: string
  clientId: string
  html: string
  attachment?: StoredAttachment | null
}): Promise<void> {
  let attachments: { filename: string; content: Buffer; contentType: string }[] | undefined
  const file = opts.attachment
  if (file) {
    const bytes = await downloadClientFileBytes(file.path)
    if (bytes && bytes.length > 0 && bytes.length <= CLIENT_FILE_MAX_BYTES) {
      attachments = [{
        filename: file.name.replace(/[\r\n"]/g, '') || 'file',
        content: bytes,
        contentType: attachmentMediaType(file.type, file.name),
      }]
    }
  }
  await sendEmail({
    to: opts.to,
    subject: portalSubject(opts.subjectBase, opts.clientId),
    html: opts.html,
    replyTo: portalReplyToAddress(),
    headers: { 'X-SH-Portal-Auto': '1' },
    attachments,
  })
}

export async function streamMessageAttachment(messageId: string, attachmentId: string, clientId: string) {
  const message = await getMessageById(messageId)
  const attachment = message && message.client_id === clientId
    ? storedAttachments(message.attachments).find((item) => item.id === attachmentId)
    : undefined
  const resolved = attachment ? resolveClientFileStoragePathForClient(attachment.path, clientId) : null
  const path = resolved ? safeObjectPath(resolved, clientId) : null
  if (!message || !attachment || !path) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const bytes = await downloadClientFileBytes(path)
  if (!bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const mediaType = attachmentMediaType(attachment.type, attachment.name)
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': mediaType,
      'Content-Disposition': attachmentContentDisposition(attachment.name, mediaType),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

async function gmailGet<T>(token: string, url: string, fetchImpl: FetchLike): Promise<T> {
  const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } })
  const payload = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message || 'Gmail request failed')
  return payload
}

async function staffInboxEmails(): Promise<string[]> {
  const emails = new Set<string>()
  const add = (value?: string | null) => {
    const match = (value || '').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)
    if (match) emails.add(match[0].toLowerCase())
  }
  add(workspaceMailbox())
  add(process.env.SMTP_USER)
  add(process.env.SMTP_FROM_EMAIL)
  add(process.env.NOTIFY_EMAIL)
  add(getAdminNotifyEmail())
  const { data } = await getSupabase().from('users').select('email, role')
  for (const user of (data || []) as { email?: string | null; role?: string | null }[]) {
    if (isStaffRole(user.role)) add(user.email)
  }
  return [...emails]
}

async function fileBytes(
  token: string,
  messageId: string,
  file: { size: number; attachmentId?: string; data?: string },
  fetchImpl: FetchLike
): Promise<Buffer | null> {
  if (file.size > CLIENT_FILE_MAX_BYTES) return null
  if (file.data) {
    const bytes = decodeGmailBytes(file.data)
    return bytes.length > CLIENT_FILE_MAX_BYTES ? null : bytes
  }
  if (!file.attachmentId) return null
  const payload = await gmailGet<{ data?: string; size?: number }>(
    token,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(file.attachmentId)}`,
    fetchImpl
  )
  if ((payload.size || 0) > CLIENT_FILE_MAX_BYTES || !payload.data) return null
  const bytes = decodeGmailBytes(payload.data)
  return bytes.length > CLIENT_FILE_MAX_BYTES ? null : bytes
}

export async function importPortalReplies(
  options: { clientId?: string; fetchImpl?: FetchLike } = {}
): Promise<{ imported: number; reason?: string }> {
  // shortcut: replies are read from the existing Workspace mailbox; SMTP-only setups still send and import nothing.
  if (!isGoogleWorkspaceConfigured()) return { imported: 0, reason: 'gmail_unconfigured' }
  if (options.clientId && !/^[0-9a-f-]{36}$/i.test(options.clientId)) return { imported: 0 }
  const fetchImpl = options.fetchImpl || fetch
  const token = await getGoogleAccessToken(fetchImpl)
  const query = options.clientId
    ? `(in:inbox OR in:sent) newer_than:14d "[portal:${options.clientId}]"`
    : '(in:inbox OR in:sent) newer_than:14d "[portal:"'
  const ids: string[] = []
  let pageToken = ''
  // shortcut: three Gmail pages; a larger backlog waits for a later run.
  for (let page = 0; page < 3; page++) {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
    url.searchParams.set('maxResults', '25')
    url.searchParams.set('q', query)
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const list = await gmailGet<{ messages?: { id?: string }[]; nextPageToken?: string }>(token, url.toString(), fetchImpl)
    for (const message of list.messages || []) {
      if (message.id) ids.push(message.id)
    }
    if (!list.nextPageToken) break
    pageToken = list.nextPageToken
  }
  if (ids.length === 0) return { imported: 0 }

  const existing = await getSupabase().from('messages').select('gmail_message_id').in('gmail_message_id', ids)
  if (existing.error) {
    if (missingColumn(existing.error)) return { imported: 0, reason: 'migration_required' }
    throw new Error(existing.error.message || 'Failed to read portal replies')
  }
  const seen = new Set(
    ((existing.data || []) as { gmail_message_id?: string | null }[])
      .map((row) => row.gmail_message_id)
      .filter((id): id is string => Boolean(id))
  )
  const staffEmails = await staffInboxEmails()
  const clients = new Map<string, { id: string; email: string; name: string } | null>()
  let imported = 0

  for (const id of ids) {
    if (seen.has(id)) continue
    try {
      const full = await gmailGet<{
        id?: string
        payload?: GmailPart & { headers?: MailHeader[] }
      }>(
        token,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
        fetchImpl
      )
      const headers = full.payload?.headers || []
      const subject = headerValue(headers, 'Subject')
      const ref = portalRefFromSubject(subject)
      if (!ref || (options.clientId && ref !== options.clientId.toLowerCase())) continue
      if (!clients.has(ref)) {
        const client = await getClientById(ref)
        clients.set(ref, client ? { id: client.id, email: client.email, name: client.name } : null)
      }
      const client = clients.get(ref)
      if (!client) continue
      const content = collectGmailContent(full.payload)
      const decision = decideInboundReply({
        subject,
        from: headerValue(headers, 'From'),
        headers,
        text: content.text,
        hasFiles: content.files.length > 0,
        client,
        staffEmails,
      })
      if (!decision.ok) continue

      const attachments: StoredAttachment[] = []
      for (const file of content.files) {
        const bytes = await fileBytes(token, id, file, fetchImpl)
        if (!bytes) continue
        const uploaded = await uploadClientFileToVault({
          clientId: client.id,
          buffer: bytes,
          contentType: file.mimeType,
          originalFileName: file.filename,
        })
        if (!uploaded.ok) continue
        const path = safeObjectPath(uploaded.data.objectPath, client.id)
        if (!path) continue
        attachments.push({
          id: randomUUID(),
          name: file.filename,
          path,
          type: file.mimeType || uploaded.data.file_type,
          size: uploaded.data.file_size,
        })
      }

      const saved = await createMessage({
        client_id: client.id,
        from_role: decision.from_role,
        from_name: decision.from_name,
        text: decision.text,
        attachments: attachments.length ? attachments : undefined,
        gmail_message_id: id,
        created_at: mailDateIso(headerValue(headers, 'Date')),
      })
      if (!saved.ok) {
        if (saved.missingColumn) return { imported, reason: 'migration_required' }
        continue
      }
      seen.add(id)
      imported += 1
      if (decision.from_role === 'admin') await notifyClientOfPortalMessage(client.id, decision.text)
    } catch (error) {
      console.error('portal reply import', id, error)
    }
  }

  return { imported }
}

export async function syncPortalThreadIfAsked(request: Request, clientId: string): Promise<void> {
  if (!clientId || new URL(request.url).searchParams.get('sync') !== '1') return
  try {
    const limit = await rateLimitDurable(`portal-mail-sync:${clientId}`, 1, 30_000)
    if (!limit.allowed) return
    await importPortalReplies({ clientId })
  } catch (error) {
    console.error('portal mail sync', error)
  }
}
