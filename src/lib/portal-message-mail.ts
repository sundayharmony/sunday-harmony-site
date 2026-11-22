export type MailHeader = { name?: string | null; value?: string | null }

export type PublicAttachment = {
  id: string
  name: string
  type: string
  size: number
}

export type StoredAttachment = PublicAttachment & {
  path: string
  fileId?: string
}

export type PublicMessage = {
  id: string
  client_id: string
  from_role: 'admin' | 'client'
  from_name: string
  text: string
  created_at: string
  attachments: PublicAttachment[]
}

export type VaultFileChoice = { id: string; name: string }

const PORTAL_REF = /\[portal:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/i
const MAX_INBOUND_FILES = 5

const MEDIA: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
}

export function portalSubject(base: string, clientId: string): string {
  const tag = `[portal:${clientId}]`
  const head = base.replace(/[\r\n\u0000\u007F-\u009F]/g, ' ').trim()
  const room = Math.max(0, 200 - tag.length - 1)
  return `${head.slice(0, room)} ${tag}`.trim()
}

export function portalRefFromSubject(subject: string): string | null {
  return subject.match(PORTAL_REF)?.[1]?.toLowerCase() || null
}

export function emailFromHeader(from: string): string {
  const match = from.match(/<([^<>\s]+@[^<>\s]+)>/)
  const raw = (match ? match[1] : from).trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : ''
}

export function displayName(from: string): string {
  const match = from.match(/^\s*"?([^"<]+?)"?\s*</)
  return match?.[1]?.replace(/[\r\n]/g, ' ').trim() || ''
}

export function headerValue(headers: MailHeader[] | undefined, name: string): string {
  const match = (headers || []).find((header) => (header.name || '').toLowerCase() === name.toLowerCase())
  return match?.value || ''
}

export function decodeGmailBytes(data: string): Buffer {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(normalized + pad, 'base64')
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim()
}

export function visibleReplyText(raw: string): string {
  const text = raw.replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim()
  const at = text.search(/\nOn [^\n]{0,500} wrote:\s*\n/i)
  const head = at === -1 ? text : text.slice(0, at)
  return head
    .split('\n')
    .filter((line) => !line.startsWith('>'))
    .join('\n')
    .trim()
    .slice(0, 10000)
}

export function inboundBody(raw: string, hasFiles: boolean): string | null {
  const visible = visibleReplyText(raw)
  if (visible) return visible
  if (hasFiles) return 'Sent an attachment.'
  return null
}

export type GmailPart = {
  mimeType?: string
  filename?: string
  body?: { data?: string; attachmentId?: string; size?: number }
  parts?: GmailPart[]
}

export type GmailFilePart = {
  filename: string
  mimeType: string
  size: number
  attachmentId?: string
  data?: string
}

export function collectGmailContent(root: GmailPart | undefined): { text: string; files: GmailFilePart[] } {
  const plain: string[] = []
  const html: string[] = []
  const files: GmailFilePart[] = []

  const walk = (part?: GmailPart) => {
    if (!part) return
    const filename = (part.filename || '').trim()
    const data = part.body?.data
    if (filename && (part.body?.attachmentId || data)) {
      if (files.length < MAX_INBOUND_FILES) {
        files.push({
          filename: filename.slice(0, 300),
          mimeType: (part.mimeType || 'application/octet-stream').split(';')[0].trim().toLowerCase(),
          size: part.body?.size || 0,
          attachmentId: part.body?.attachmentId,
          data,
        })
      }
    } else if (data && !filename) {
      const decoded = decodeGmailBytes(data).toString('utf8')
      const mime = (part.mimeType || '').toLowerCase()
      if (mime.startsWith('text/plain')) plain.push(decoded)
      else if (mime.startsWith('text/html')) html.push(decoded)
    }
    for (const child of part.parts || []) walk(child)
  }

  walk(root)
  const text = plain.map((part) => part.trim()).filter(Boolean).join('\n').trim() || htmlToText(html.join('\n'))
  return { text, files }
}

export function decideInboundReply(input: {
  subject: string
  from: string
  headers: MailHeader[]
  text: string
  hasFiles: boolean
  client: { id: string; email: string; name: string }
  staffEmails: string[]
}):
  | { ok: true; from_role: 'admin' | 'client'; from_name: string; text: string }
  | { ok: false; reason: string } {
  const ref = portalRefFromSubject(input.subject)
  if (!ref || ref !== input.client.id.toLowerCase()) return { ok: false, reason: 'thread' }
  // shortcut: a reply that copies X-SH-Portal-Auto is ignored.
  if (headerValue(input.headers, 'X-SH-Portal-Auto').trim() === '1') return { ok: false, reason: 'auto' }
  const reply =
    /^(re|fwd|fw)\s*:/i.test(input.subject.trim()) ||
    headerValue(input.headers, 'In-Reply-To').trim() ||
    headerValue(input.headers, 'References').trim()
  if (!reply) return { ok: false, reason: 'not_reply' }

  const from = emailFromHeader(input.from)
  if (!from) return { ok: false, reason: 'from' }
  const staff = new Set(input.staffEmails.map((email) => email.trim().toLowerCase()).filter(Boolean))
  const clientEmail = input.client.email.trim().toLowerCase()
  let fromRole: 'admin' | 'client'
  let fromName: string
  if (from === clientEmail) {
    fromRole = 'client'
    fromName = input.client.name.trim() || displayName(input.from) || 'Client'
  } else if (staff.has(from)) {
    fromRole = 'admin'
    fromName = displayName(input.from) || 'Sunday Harmony'
  } else {
    return { ok: false, reason: 'sender' }
  }

  const text = inboundBody(input.text, input.hasFiles)
  if (!text) return { ok: false, reason: 'empty' }
  return { ok: true, from_role: fromRole, from_name: fromName.slice(0, 200), text }
}

export function publicAttachments(value: unknown): PublicAttachment[] {
  if (!Array.isArray(value)) return []
  const attachments: PublicAttachment[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || typeof row.name !== 'string') continue
    attachments.push({
      id: row.id,
      name: row.name,
      type: typeof row.type === 'string' ? row.type : '',
      size: typeof row.size === 'number' ? row.size : 0,
    })
  }
  return attachments
}

export function storedAttachments(value: unknown): StoredAttachment[] {
  if (!Array.isArray(value)) return []
  const attachments: StoredAttachment[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.path !== 'string' || !row.path) continue
    attachments.push({
      id: row.id,
      name: row.name,
      path: row.path,
      type: typeof row.type === 'string' ? row.type : '',
      size: typeof row.size === 'number' ? row.size : 0,
      fileId: typeof row.fileId === 'string' ? row.fileId : undefined,
    })
  }
  return attachments
}

export function publicMessage(message: {
  id: string
  client_id: string
  from_role: 'admin' | 'client'
  from_name: string
  text: string
  created_at: string
  attachments?: unknown
}): PublicMessage {
  return {
    id: message.id,
    client_id: message.client_id,
    from_role: message.from_role,
    from_name: message.from_name,
    text: message.text,
    created_at: message.created_at,
    attachments: publicAttachments(message.attachments),
  }
}

function asMessages(value: unknown): PublicMessage[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const message = item as PublicMessage
    if (typeof message.id !== 'string' || typeof message.text !== 'string') return []
    return [{ ...message, attachments: publicAttachments(message.attachments) }]
  })
}

export function parseThreadPayload(data: unknown): { messages: PublicMessage[]; files: VaultFileChoice[] } {
  if (Array.isArray(data)) return { messages: asMessages(data), files: [] }
  if (!data || typeof data !== 'object') return { messages: [], files: [] }
  const row = data as { messages?: unknown; files?: unknown }
  const messages = asMessages(row.messages)
  const files = Array.isArray(row.files)
    ? row.files.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const file = item as { id?: unknown; name?: unknown }
        if (typeof file.id !== 'string' || typeof file.name !== 'string') return []
        return [{ id: file.id, name: file.name }]
      })
    : []
  return { messages, files }
}

export function safeObjectPath(path: string, clientId: string): string | null {
  if (!clientId || !path || path.includes('..') || path.includes('\\') || path.startsWith('/')) return null
  if (!path.startsWith(`${clientId}/`)) return null
  return path
}

export function attachmentMediaType(type: string, name: string): string {
  const raw = (type || '').split(';')[0].trim().toLowerCase()
  if (raw.includes('/')) return raw
  const ext = (raw || name.split('.').pop() || '').toLowerCase()
  return MEDIA[ext] || 'application/octet-stream'
}

export function isImageAttachment(type: string, name: string): boolean {
  const media = attachmentMediaType(type, name)
  return media.startsWith('image/') && media !== 'image/svg+xml'
}

export function attachmentContentDisposition(name: string, mediaType: string): string {
  const clean = name.replace(/[\r\n"]/g, '').replace(/[^\x20-\x7E]/g, '_').slice(0, 180) || 'file'
  const kind = mediaType.startsWith('image/') ? 'inline' : 'attachment'
  return `${kind}; filename="${clean}"`
}

export function mailDateIso(value: string): string {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return new Date().toISOString()
  return new Date(parsed).toISOString()
}
