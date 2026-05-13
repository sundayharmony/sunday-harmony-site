import { randomUUID } from 'crypto'
import { getSupabase } from '@/lib/supabase'

export const CLIENT_FILES_BUCKET = 'client-files'

/** Aligns with typical Vercel request body limits; raise only if your plan supports larger payloads. */
export const CLIENT_FILE_MAX_BYTES = 4 * 1024 * 1024

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

function extensionFromName(name: string): string {
  const i = name.lastIndexOf('.')
  if (i <= 0 || i === name.length - 1) return 'bin'
  return name.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
}

/** Browsers often send empty type or application/octet-stream; infer from extension when possible. */
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
  publicUrl: string
  objectPath: string
  file_size: number
  file_type: string
  displayName: string
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

  const { data: pub } = supabase.storage.from(CLIENT_FILES_BUCKET).getPublicUrl(objectPath)
  const publicUrl = pub?.publicUrl
  if (!publicUrl) return { ok: false, error: 'Could not resolve public URL' }

  let displayName = (displayNameOverride || '').trim() || sanitizeStorageFileName(originalFileName).replace(/_/g, ' ')
  if (displayName.length > 300) displayName = displayName.slice(0, 300)
  const file_type = extensionFromName(originalFileName)

  return {
    ok: true,
    data: {
      publicUrl,
      objectPath,
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

export async function removeClientFileByPublicUrlIfOurs(fileUrl: string): Promise<void> {
  const path = storageObjectPathFromPublicUrl(fileUrl)
  if (!path) return
  const { error } = await getSupabase().storage.from(CLIENT_FILES_BUCKET).remove([path])
  if (error) console.error('Storage remove error:', error)
}
