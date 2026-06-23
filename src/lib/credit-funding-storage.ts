import { randomUUID } from 'crypto'
import { getSupabase } from '@/lib/supabase'
import type { StorageDocumentType } from '@/lib/credit-funding-types'

import { CREDIT_FUNDING_MAX_BYTES } from '@/lib/credit-funding-types'

export const CREDIT_FUNDING_BUCKET = 'credit-funding-docs'
export { CREDIT_FUNDING_MAX_BYTES }

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
])

const MAGIC_SIGNATURES: Array<{ mime: string; check: (buf: Buffer) => boolean }> = [
  { mime: 'application/pdf', check: (b) => b.subarray(0, 5).toString() === '%PDF-' },
  { mime: 'image/png', check: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
]

function extensionFromName(name: string): string {
  const i = name.lastIndexOf('.')
  if (i <= 0 || i === name.length - 1) return 'bin'
  return name.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
}

function effectiveContentType(contentType: string, originalFileName: string): string {
  let ct = (contentType || '').split(';')[0].trim().toLowerCase()
  if (ct && ct !== 'application/octet-stream') return ct

  const ext = extensionFromName(originalFileName)
  const byExt: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  }
  return byExt[ext] || ct || 'application/octet-stream'
}

export function sanitizeStorageFileName(original: string): string {
  const base = original.replace(/^.*[/\\]/, '').trim() || 'file'
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
  return cleaned || 'file'
}

/** Basic virus/malware heuristic: validate magic bytes and reject embedded executables. */
export function scanFileBuffer(buffer: Buffer, mimeType: string): { ok: true } | { ok: false; reason: string } {
  if (buffer.length < 4) return { ok: false, reason: 'File too small or empty' }

  const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType
  const sig = MAGIC_SIGNATURES.find((s) => s.mime === normalizedMime || (normalizedMime === 'image/jpeg' && s.mime === 'image/jpeg'))
  if (!sig || !sig.check(buffer)) {
    return { ok: false, reason: 'File content does not match declared type' }
  }

  const mzIndex = buffer.indexOf(Buffer.from('MZ'))
  if (mzIndex >= 0 && mzIndex < buffer.length - 64) {
    const peOffset = buffer.readUInt32LE(mzIndex + 0x3c)
    if (peOffset > 0 && peOffset < buffer.length - 4) {
      const peSig = buffer.subarray(peOffset, peOffset + 4).toString()
      if (peSig === 'PE\0\0') {
        return { ok: false, reason: 'Executable content detected' }
      }
    }
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 8192)).toString('latin1').toLowerCase()
  if (sample.includes('<script') || sample.includes('javascript:')) {
    return { ok: false, reason: 'Suspicious script content detected' }
  }

  return { ok: true }
}

export function validateCreditFundingFile(
  contentType: string,
  sizeBytes: number,
  originalFileName: string
): { ok: true; mime: string } | { ok: false; error: string } {
  if (sizeBytes <= 0) return { ok: false, error: 'Empty file' }
  if (sizeBytes > CREDIT_FUNDING_MAX_BYTES) {
    return { ok: false, error: `File too large (max ${CREDIT_FUNDING_MAX_BYTES / (1024 * 1024)} MB)` }
  }

  const ext = extensionFromName(originalFileName)
  if (!['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
    return { ok: false, error: 'File type not allowed. Use PDF, JPG, JPEG, or PNG.' }
  }

  const mime = effectiveContentType(contentType, originalFileName)
  const normalized = mime === 'image/jpg' ? 'image/jpeg' : mime
  if (!ALLOWED_MIME.has(normalized) && !ALLOWED_MIME.has(mime)) {
    return { ok: false, error: 'File type not allowed. Use PDF, JPG, JPEG, or PNG.' }
  }

  return { ok: true, mime: normalized }
}

export interface StagedCreditFundingFile {
  documentType: StorageDocumentType
  storagePath: string
  file_name: string
  file_size: number
  file_type: string
  mime_type: string
  scan_status: 'clean' | 'rejected'
}

const STAGING_PREFIX = 'staging'

export function isValidUploadSessionId(sessionId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)
}

export function isStagedPathForSession(storagePath: string, sessionId: string): boolean {
  return storagePath.startsWith(`${STAGING_PREFIX}/${sessionId}/`)
}

export async function stageCreditFundingDocument(params: {
  sessionId: string
  documentType: StorageDocumentType
  buffer: Buffer
  contentType: string
  originalFileName: string
}): Promise<{ ok: true; data: StagedCreditFundingFile } | { ok: false; error: string }> {
  const { sessionId, documentType, buffer, contentType, originalFileName } = params
  if (!isValidUploadSessionId(sessionId)) {
    return { ok: false, error: 'Invalid upload session' }
  }

  const v = validateCreditFundingFile(contentType, buffer.length, originalFileName)
  if (!v.ok) return { ok: false, error: v.error }

  const scan = scanFileBuffer(buffer, v.mime)
  if (!scan.ok) return { ok: false, error: scan.reason }

  const safe = sanitizeStorageFileName(originalFileName)
  const objectPath = `${STAGING_PREFIX}/${sessionId}/${documentType}/${randomUUID()}_${safe}`

  const supabase = getSupabase()
  const { error: upErr } = await supabase.storage.from(CREDIT_FUNDING_BUCKET).upload(objectPath, buffer, {
    contentType: v.mime,
    upsert: false,
  })

  if (upErr) {
    console.error('Credit funding staging upload error:', upErr)
    return { ok: false, error: upErr.message || 'Upload failed' }
  }

  const displayName = sanitizeStorageFileName(originalFileName).replace(/_/g, ' ')
  return {
    ok: true,
    data: {
      documentType,
      storagePath: objectPath,
      file_size: buffer.length,
      file_type: extensionFromName(originalFileName),
      mime_type: v.mime,
      file_name: displayName.slice(0, 300),
      scan_status: 'clean',
    },
  }
}

export async function finalizeStagedCreditFundingDocument(params: {
  applicationUuid: string
  staged: StagedCreditFundingFile
  sessionId: string
}): Promise<{ ok: true; data: UploadCreditFundingDocResult } | { ok: false; error: string }> {
  const { applicationUuid, staged, sessionId } = params
  if (!isStagedPathForSession(staged.storagePath, sessionId)) {
    return { ok: false, error: 'Invalid staged file path' }
  }

  const fileName = staged.storagePath.split('/').pop() || 'file'
  const destPath = `${applicationUuid}/${staged.documentType}/${fileName}`

  const supabase = getSupabase()
  const { error: moveErr } = await supabase.storage.from(CREDIT_FUNDING_BUCKET).move(staged.storagePath, destPath)
  if (moveErr) {
    console.error('Credit funding staging move error:', moveErr)
    return { ok: false, error: moveErr.message || 'Failed to finalize upload' }
  }

  return {
    ok: true,
    data: {
      storagePath: destPath,
      file_size: staged.file_size,
      file_type: staged.file_type,
      mime_type: staged.mime_type,
      displayName: staged.file_name,
      scan_status: staged.scan_status,
    },
  }
}

export async function removeStagedCreditFundingSession(sessionId: string): Promise<void> {
  if (!isValidUploadSessionId(sessionId)) return
  const supabase = getSupabase()
  const base = `${STAGING_PREFIX}/${sessionId}`
  const { data: docTypes } = await supabase.storage.from(CREDIT_FUNDING_BUCKET).list(base)
  if (!docTypes?.length) return

  const paths: string[] = []
  for (const docFolder of docTypes) {
    const { data: files } = await supabase.storage.from(CREDIT_FUNDING_BUCKET).list(`${base}/${docFolder.name}`)
    for (const f of files || []) {
      paths.push(`${base}/${docFolder.name}/${f.name}`)
    }
  }

  if (paths.length) {
    await supabase.storage.from(CREDIT_FUNDING_BUCKET).remove(paths)
  }
}

export interface UploadCreditFundingDocResult {
  storagePath: string
  file_size: number
  file_type: string
  mime_type: string
  displayName: string
  scan_status: 'clean' | 'rejected'
}

export async function uploadCreditFundingDocument(params: {
  applicationUuid: string
  documentType: StorageDocumentType
  buffer: Buffer
  contentType: string
  originalFileName: string
}): Promise<{ ok: true; data: UploadCreditFundingDocResult } | { ok: false; error: string }> {
  const { applicationUuid, documentType, buffer, contentType, originalFileName } = params

  const v = validateCreditFundingFile(contentType, buffer.length, originalFileName)
  if (!v.ok) return { ok: false, error: v.error }

  const scan = scanFileBuffer(buffer, v.mime)
  if (!scan.ok) return { ok: false, error: scan.reason }

  const safe = sanitizeStorageFileName(originalFileName)
  const objectPath = `${applicationUuid}/${documentType}/${randomUUID()}_${safe}`

  const supabase = getSupabase()
  const { error: upErr } = await supabase.storage.from(CREDIT_FUNDING_BUCKET).upload(objectPath, buffer, {
    contentType: v.mime,
    upsert: false,
  })

  if (upErr) {
    console.error('Credit funding storage upload error:', upErr)
    return { ok: false, error: upErr.message || 'Upload failed' }
  }

  const displayName = sanitizeStorageFileName(originalFileName).replace(/_/g, ' ')
  return {
    ok: true,
    data: {
      storagePath: objectPath,
      file_size: buffer.length,
      file_type: extensionFromName(originalFileName),
      mime_type: v.mime,
      displayName: displayName.slice(0, 300),
      scan_status: 'clean',
    },
  }
}

export async function getCreditFundingDocumentSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const { data, error } = await getSupabase()
    .storage
    .from(CREDIT_FUNDING_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    console.error('Signed URL error:', error)
    return null
  }
  return data.signedUrl
}
