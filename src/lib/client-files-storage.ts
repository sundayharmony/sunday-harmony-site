import { randomUUID } from 'crypto'
import { getSupabase } from '@/lib/supabase'

export const CLIENT_FILES_BUCKET = 'client-files'

/** Aligns with typical Vercel request body limits; raise only if your plan supports larger payloads. */
export const CLIENT_FILE_MAX_BYTES = 4 * 1024 * 1024

const SIGNED_URL_TTL_SEC = 3600

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/zip',
])

const MAGIC_SIGNATURES: Array<{ mime: string; check: (buf: Buffer) => boolean }> = [
  { mime: 'application/pdf', check: (b) => b.subarray(0, 5).toString() === '%PDF-' },
  {
    mime: 'image/png',
    check: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  { mime: 'image/jpeg', check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', check: (b) => b.subarray(0, 6).toString() === 'GIF87a' || b.subarray(0, 6).toString() === 'GIF89a' },
  { mime: 'image/webp', check: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  { mime: 'text/plain', check: () => true },
  { mime: 'text/csv', check: () => true },
]

import { extensionFromName } from '@/lib/storage-utils'

function effectiveContentType(contentType: string, originalFileName: string): string {
  let ct = (contentType || '').split(';')[0].trim().toLowerCase()
  if (ct && ct !== 'application/octet-stream') return ct

  const ext = extensionFromName(originalFileName)
  const byExt: Record<string, string> = {
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
  return byExt[ext] || ct || 'application/octet-stream'
}

function scanFileBuffer(buffer: Buffer, mimeType: string): { ok: true } | { ok: false; reason: string } {
  if (buffer.length < 4) return { ok: false, reason: 'File too small or empty' }

  const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType
  const sig = MAGIC_SIGNATURES.find((s) => s.mime === normalizedMime)
  if (sig && !sig.check(buffer)) {
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

  return { ok: true }
}

export function sanitizeStorageFileName(original: string): string {
  const base = original.replace(/^.*[/\\]/, '').trim() || 'file'
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
  return cleaned || 'file'
}

export function validateClientFile(contentType: string, sizeBytes: number): { ok: true } | { ok: false; error: string } {
  if (sizeBytes <= 0) return { ok: false, error: 'Empty file' }
  if (sizeBytes > CLIENT_FILE_MAX_BYTES) {
    return { ok: false, error: `File too large (max ${Math.floor(CLIENT_FILE_MAX_BYTES / (1024 * 1024))} MB)` }
  }
  const ct = (contentType || 'application/octet-stream').split(';')[0].trim().toLowerCase()
  if (!ALLOWED_MIME.has(ct)) {
    return { ok: false, error: 'File type not allowed' }
  }
  return { ok: true }
}

export interface UploadClientFileResult {
  /** Storage object path within client-files bucket (persist in DB). */
  objectPath: string
  /** Time-limited signed URL for immediate download. */
  signedUrl: string
  file_size: number
  file_type: string
  displayName: string
}

/** Resolve storage path from persisted file_url (object path or legacy public URL). */
export function resolveClientFileStoragePath(fileUrl: string): string | null {
  if (!fileUrl) return null
  const fromPublic = storageObjectPathFromPublicUrl(fileUrl)
  if (fromPublic) return fromPublic
  if (/^[0-9a-f-]{36}\/[0-9a-f-]{36}_/i.test(fileUrl) || /^[0-9a-f-]{36}\//i.test(fileUrl)) {
    return fileUrl.replace(/^\//, '')
  }
  return null
}

export function resolveClientFileStoragePathForClient(
  fileUrl: string,
  clientId: string
): string | null {
  const objectPath = resolveClientFileStoragePath(fileUrl)
  if (!objectPath || !clientId || !objectPath.startsWith(`${clientId}/`)) return null
  return objectPath
}

export async function getClientFileSignedUrl(objectPath: string, expiresInSec = SIGNED_URL_TTL_SEC): Promise<string | null> {
  if (!objectPath) return null
  const { data, error } = await getSupabase().storage
    .from(CLIENT_FILES_BUCKET)
    .createSignedUrl(objectPath, expiresInSec)
  if (error) {
    console.error('Signed URL error:', error)
    return null
  }
  return data?.signedUrl ?? null
}

export async function withSignedClientFileUrls<T extends { file_url: string }>(
  files: T[]
): Promise<(T & { file_url: string })[]> {
  return Promise.all(
    files.map(async (file) => {
      const path = resolveClientFileStoragePath(file.file_url)
      if (!path) return file
      const signed = await getClientFileSignedUrl(path)
      return signed ? { ...file, file_url: signed } : file
    })
  )
}

export async function uploadClientFileToVault(params: {
  clientId: string
  buffer: Buffer
  contentType: string
  originalFileName: string
  displayNameOverride?: string
}): Promise<{ ok: true; data: UploadClientFileResult } | { ok: false; error: string }> {
  const { clientId, buffer, contentType, originalFileName, displayNameOverride } = params
  const effective = effectiveContentType(contentType, originalFileName)
  const v = validateClientFile(effective, buffer.length)
  if (!v.ok) return { ok: false, error: v.error }

  const scan = scanFileBuffer(buffer, effective)
  if (!scan.ok) return { ok: false, error: scan.reason }

  const safe = sanitizeStorageFileName(originalFileName)
  const objectPath = `${clientId}/${randomUUID()}_${safe}`

  const supabase = getSupabase()
  const { error: upErr } = await supabase.storage.from(CLIENT_FILES_BUCKET).upload(objectPath, buffer, {
    contentType: effective,
    upsert: false,
  })

  if (upErr) {
    console.error('Storage upload error:', upErr)
    return { ok: false, error: upErr.message || 'Upload failed' }
  }

  const signedUrl = await getClientFileSignedUrl(objectPath)
  if (!signedUrl) return { ok: false, error: 'Could not create signed URL' }

  let displayName = (displayNameOverride || '').trim() || sanitizeStorageFileName(originalFileName).replace(/_/g, ' ')
  if (displayName.length > 300) displayName = displayName.slice(0, 300)
  const file_type = extensionFromName(originalFileName)

  return {
    ok: true,
    data: {
      objectPath,
      signedUrl,
      file_size: buffer.length,
      file_type,
      displayName,
    },
  }
}

/** If URL is a public object URL for this bucket, return storage object path for removal. */
export function storageObjectPathFromPublicUrl(fileUrl: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base || !fileUrl) return null
  let expectedOrigin: string
  let actualOrigin: string
  try {
    expectedOrigin = new URL(base).origin
    actualOrigin = new URL(fileUrl).origin
  } catch {
    return null
  }
  if (actualOrigin !== expectedOrigin) return null

  const normalizedUrl = fileUrl.replace(/\/$/, '')
  const marker = `/storage/v1/object/public/${CLIENT_FILES_BUCKET}/`
  const idx = normalizedUrl.indexOf(marker)
  if (idx === -1) return null
  try {
    return decodeURIComponent(normalizedUrl.slice(idx + marker.length))
  } catch {
    return normalizedUrl.slice(idx + marker.length)
  }
}

export async function removeClientFileByStoragePath(objectPath: string): Promise<void> {
  if (!objectPath) return
  const { error } = await getSupabase().storage.from(CLIENT_FILES_BUCKET).remove([objectPath])
  if (error) console.error('Storage remove error:', error)
}

export async function removeClientFileByPublicUrlIfOurs(fileUrl: string): Promise<void> {
  const path = resolveClientFileStoragePath(fileUrl)
  if (!path) return
  await removeClientFileByStoragePath(path)
}

/** Remove all objects under a client prefix in the vault bucket. */
export async function removeAllClientFilesFromVault(clientId: string): Promise<void> {
  const supabase = getSupabase()
  const { data, error } = await supabase.storage.from(CLIENT_FILES_BUCKET).list(clientId, { limit: 1000 })
  if (error) {
    console.error('Storage list error:', error)
    return
  }
  const paths = (data || [])
    .filter((item) => item.name)
    .map((item) => `${clientId}/${item.name}`)
  if (paths.length === 0) return
  const { error: removeErr } = await supabase.storage.from(CLIENT_FILES_BUCKET).remove(paths)
  if (removeErr) console.error('Storage bulk remove error:', removeErr)
}
