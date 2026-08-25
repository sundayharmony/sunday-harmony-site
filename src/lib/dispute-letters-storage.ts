import { randomUUID } from 'crypto'
import {
  effectiveContentType,
  extensionFromName,
  hasSafeStoragePathSegments,
} from '@/lib/storage-utils'
import { getSupabase } from '@/lib/supabase'

export const DISPUTE_LETTERS_BUCKET = 'dispute-letters'
export const DISPUTE_LETTER_MAX_BYTES = 50 * 1024 * 1024
export const DISPUTE_LETTER_MAX_MB = DISPUTE_LETTER_MAX_BYTES / (1024 * 1024)

const ALLOWED_MIME = new Set([
  'application/pdf',
  'text/html',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/png',
  'image/jpeg',
  'image/jpg',
])

const MAGIC_SIGNATURES: Array<{ mime: string; check: (buf: Buffer) => boolean }> = [
  { mime: 'application/pdf', check: (b) => b.subarray(0, 5).toString() === '%PDF-' },
  { mime: 'image/png', check: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'text/html', check: (b) => {
    const head = b.subarray(0, Math.min(512, b.length)).toString('utf8').toLowerCase()
    return head.includes('<html') || head.includes('<!doctype')
  }},
]

export function sanitizeDisputeFileName(original: string): string {
  const base = original.replace(/^.*[/\\]/, '').trim() || 'report'
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
  return cleaned || 'report'
}

export function buildDisputeReportObjectPath(sessionId: string, originalFileName: string): string {
  return `sessions/${sessionId}/report/${sanitizeDisputeFileName(originalFileName)}`
}

export function isValidDisputeReportStoragePath(storagePath: string, sessionId: string): boolean {
  return (
    /^[0-9a-f-]{36}$/i.test(sessionId) &&
    hasSafeStoragePathSegments(storagePath) &&
    storagePath.startsWith(`sessions/${sessionId}/report/`) &&
    storagePath.split('/').length === 4
  )
}

export function scanDisputeFileBuffer(buffer: Buffer, mimeType: string): { ok: true } | { ok: false; reason: string } {
  if (buffer.length < 4) return { ok: false, reason: 'File too small or empty' }
  const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType
  let contentMatches = normalizedMime === 'text/plain'
  if (normalizedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    contentMatches =
      buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
      buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])) ||
      buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x07, 0x08]))
  } else if (normalizedMime === 'application/msword') {
    contentMatches = buffer.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))
  } else if (normalizedMime !== 'text/plain') {
    const signature = MAGIC_SIGNATURES.find((entry) => entry.mime === normalizedMime)
    contentMatches = Boolean(signature?.check(buffer))
  }

  if (!contentMatches) {
    return { ok: false, reason: 'File content does not match declared type' }
  }

  const mzIndex = buffer.indexOf(Buffer.from('MZ'))
  if (mzIndex >= 0 && mzIndex < buffer.length - 64) {
    const peOffset = buffer.readUInt32LE(mzIndex + 0x3c)
    if (peOffset > 0 && peOffset < buffer.length - 4) {
      const peSignature = buffer.subarray(peOffset, peOffset + 4).toString()
      if (peSignature === 'PE\0\0') {
        return { ok: false, reason: 'Executable content detected' }
      }
    }
  }
  return { ok: true }
}

export function validateDisputeReportFile(
  contentType: string,
  sizeBytes: number,
  originalFileName: string
): { ok: true; effectiveMime: string } | { ok: false; error: string } {
  if (sizeBytes <= 0) return { ok: false, error: 'Empty file' }
  if (sizeBytes > DISPUTE_LETTER_MAX_BYTES) {
    return { ok: false, error: `File too large (max ${DISPUTE_LETTER_MAX_MB} MB)` }
  }
  const ext = extensionFromName(originalFileName)
  const byExt: Record<string, string> = {
    pdf: 'application/pdf',
    html: 'text/html',
    htm: 'text/html',
    txt: 'text/plain',
    text: 'text/plain',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  }
  let effective = effectiveContentType(contentType, originalFileName)
  if (!ALLOWED_MIME.has(effective) && byExt[ext]) {
    effective = byExt[ext]
  }
  const extensionMime = byExt[ext]
  const normalizedEffective = effective === 'image/jpg' ? 'image/jpeg' : effective
  const normalizedExtension = extensionMime === 'image/jpg' ? 'image/jpeg' : extensionMime
  if (extensionMime && normalizedEffective !== normalizedExtension) {
    return { ok: false, error: 'File extension does not match the declared content type' }
  }
  if (!ALLOWED_MIME.has(effective)) {
    return { ok: false, error: 'Unsupported file type. Use HTML, PDF, TXT, Word, PNG, or JPEG.' }
  }
  return { ok: true, effectiveMime: effective }
}

export interface DisputeSignedUpload {
  sessionId: string
  signedUrl: string
  path: string
  token: string
}

export async function createDisputeLetterSignedUploadUrl(params: {
  sessionId: string
  originalFileName: string
  contentType: string
  fileSize: number
}): Promise<{ ok: true; data: DisputeSignedUpload } | { ok: false; error: string }> {
  const v = validateDisputeReportFile(params.contentType, params.fileSize, params.originalFileName)
  if (!v.ok) return { ok: false, error: v.error }

  const objectPath = buildDisputeReportObjectPath(params.sessionId, params.originalFileName)
  const supabase = getSupabase()
  const signed = await supabase.storage.from(DISPUTE_LETTERS_BUCKET).createSignedUploadUrl(objectPath)

  if (signed.error || !signed.data?.signedUrl || !signed.data?.token) {
    console.error('Dispute letter signed upload URL error:', signed.error)
    return { ok: false, error: signed.error?.message || 'Could not create upload URL' }
  }

  return {
    ok: true,
    data: {
      sessionId: params.sessionId,
      signedUrl: signed.data.signedUrl,
      path: signed.data.path || objectPath,
      token: signed.data.token,
    },
  }
}

export async function getDisputeLetterSignedDownloadUrl(
  storagePath: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data, error } = await getSupabase()
    .storage.from(DISPUTE_LETTERS_BUCKET)
    .createSignedUrl(storagePath, expiresIn)
  if (error) {
    console.error('Dispute letter signed download error:', error)
    return null
  }
  return data?.signedUrl || null
}

export async function downloadDisputeLetterBytes(storagePath: string): Promise<Buffer | null> {
  const { data, error } = await getSupabase().storage.from(DISPUTE_LETTERS_BUCKET).download(storagePath)
  if (error || !data) {
    console.error('Dispute letter download error:', error)
    return null
  }
  const ab = await data.arrayBuffer()
  return Buffer.from(ab)
}

export async function verifyDisputeReportObject(params: {
  storagePath: string
  sessionId: string
  originalFileName: string
}): Promise<{ ok: true; buffer: Buffer; mimeType: string } | { ok: false; error: string }> {
  if (!isValidDisputeReportStoragePath(params.storagePath, params.sessionId)) {
    return { ok: false, error: 'Invalid report storage path' }
  }

  const buffer = await downloadDisputeLetterBytes(params.storagePath)
  if (!buffer) return { ok: false, error: 'Uploaded report not found' }

  const validation = validateDisputeReportFile(
    'application/octet-stream',
    buffer.length,
    params.originalFileName
  )
  if (!validation.ok) return validation

  const scan = scanDisputeFileBuffer(buffer, validation.effectiveMime)
  if (!scan.ok) return { ok: false, error: scan.reason }
  return { ok: true, buffer, mimeType: validation.effectiveMime }
}

export async function removeDisputeReportObject(storagePath: string): Promise<void> {
  if (!storagePath) return
  const { error } = await getSupabase().storage.from(DISPUTE_LETTERS_BUCKET).remove([storagePath])
  if (error) console.error('Dispute report remove error:', error)
}

/** Remove report + letter objects under sessions/{sessionId}/. Best-effort. */
export async function removeDisputeSessionStorage(sessionId: string, storagePath?: string | null): Promise<void> {
  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) return

  const client = getSupabase().storage.from(DISPUTE_LETTERS_BUCKET)
  const paths = new Set<string>()
  if (storagePath) paths.add(storagePath)

  for (const folder of [`sessions/${sessionId}/report`, `sessions/${sessionId}/letters`]) {
    const { data, error } = await client.list(folder, { limit: 100 })
    if (error) {
      console.error('Dispute session storage list error:', folder, error)
      continue
    }
    for (const item of data || []) {
      if (item.name) paths.add(`${folder}/${item.name}`)
    }
  }

  if (paths.size === 0) return
  const { error } = await client.remove([...paths])
  if (error) console.error('Dispute session storage remove error:', error)
}

export function newDisputeSessionId(): string {
  return randomUUID()
}

/** Safe download filename for the generated letters ZIP bundle. */
export function disputeLettersZipDownloadName(consumerName: string | null | undefined): string {
  const cleaned =
    (consumerName || 'Client')
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 80) || 'Client'
  return `${cleaned} round 1 Letters.zip`
}
