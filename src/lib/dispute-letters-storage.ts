import { randomUUID } from 'crypto'
import { effectiveContentType, extensionFromName } from '@/lib/storage-utils'
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

export function scanDisputeFileBuffer(buffer: Buffer, mimeType: string): { ok: true } | { ok: false; reason: string } {
  if (buffer.length < 4) return { ok: false, reason: 'File too small or empty' }
  const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType
  if (normalizedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      normalizedMime === 'application/msword' ||
      normalizedMime === 'text/plain') {
    return { ok: true }
  }
  const sig = MAGIC_SIGNATURES.find((s) => s.mime === normalizedMime)
  if (sig && !sig.check(buffer)) {
    return { ok: false, reason: 'File content does not match declared type' }
  }
  const mzIndex = buffer.indexOf(Buffer.from('MZ'))
  if (mzIndex >= 0 && mzIndex < buffer.length - 64) {
    return { ok: false, reason: 'Executable content detected' }
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
