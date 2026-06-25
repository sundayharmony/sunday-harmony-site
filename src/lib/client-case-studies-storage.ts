import { randomUUID } from 'crypto'
import { getSupabase } from '@/lib/supabase'

export const CLIENT_CASE_STUDIES_BUCKET = 'client-case-studies'

/** One-sheet PDFs; align with bucket file_size_limit in migration 016 / 019. */
export const CASE_STUDY_PDF_MAX_BYTES = 50 * 1024 * 1024

const PDF_MIME = 'application/pdf'

function extensionFromName(name: string): string {
  const i = name.lastIndexOf('.')
  if (i <= 0 || i === name.length - 1) return 'bin'
  return name.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
}

function effectiveContentType(contentType: string, originalFileName: string): string {
  let ct = (contentType || '').split(';')[0].trim().toLowerCase()
  if (ct && ct !== 'application/octet-stream') return ct
  if (extensionFromName(originalFileName) === 'pdf') return PDF_MIME
  return ct || 'application/octet-stream'
}

export function sanitizeCaseStudyFileName(original: string): string {
  const base = original.replace(/^.*[/\\]/, '').trim() || 'case-study.pdf'
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
  return cleaned || 'case-study.pdf'
}

export function validateCaseStudyPdf(contentType: string, sizeBytes: number): { ok: true } | { ok: false; error: string } {
  if (sizeBytes <= 0) return { ok: false, error: 'Empty file' }
  if (sizeBytes > CASE_STUDY_PDF_MAX_BYTES) {
    return { ok: false, error: `PDF too large (max ${Math.floor(CASE_STUDY_PDF_MAX_BYTES / (1024 * 1024))} MB)` }
  }
  const ct = effectiveContentType(contentType, 'file.pdf')
  if (ct !== PDF_MIME) {
    return { ok: false, error: 'Only PDF files are allowed for case studies' }
  }
  return { ok: true }
}

export interface UploadCaseStudyPdfResult {
  publicUrl: string
  objectPath: string
  file_size: number
}

export async function uploadCaseStudyPdf(params: {
  buffer: Buffer
  contentType: string
  originalFileName: string
}): Promise<{ ok: true; data: UploadCaseStudyPdfResult } | { ok: false; error: string }> {
  const { buffer, contentType, originalFileName } = params
  const effective = effectiveContentType(contentType, originalFileName)
  const v = validateCaseStudyPdf(effective, buffer.length)
  if (!v.ok) return { ok: false, error: v.error }

  const safe = sanitizeCaseStudyFileName(originalFileName)
  const objectPath = `uploads/${randomUUID()}_${safe}`

  const supabase = getSupabase()
  const { error: upErr } = await supabase.storage.from(CLIENT_CASE_STUDIES_BUCKET).upload(objectPath, buffer, {
    contentType: PDF_MIME,
    upsert: false,
  })

  if (upErr) {
    console.error('Case study storage upload error:', upErr)
    return { ok: false, error: upErr.message || 'Upload failed' }
  }

  const { data: pub } = supabase.storage.from(CLIENT_CASE_STUDIES_BUCKET).getPublicUrl(objectPath)
  const publicUrl = pub?.publicUrl
  if (!publicUrl) return { ok: false, error: 'Could not resolve public URL' }

  return {
    ok: true,
    data: {
      publicUrl,
      objectPath,
      file_size: buffer.length,
    },
  }
}

export function storageObjectPathFromCaseStudyUrl(fileUrl: string): string | null {
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
  const marker = `/storage/v1/object/public/${CLIENT_CASE_STUDIES_BUCKET}/`
  const idx = normalizedUrl.indexOf(marker)
  if (idx === -1) return null
  try {
    return decodeURIComponent(normalizedUrl.slice(idx + marker.length))
  } catch {
    return normalizedUrl.slice(idx + marker.length)
  }
}

export async function removeCaseStudyByPublicUrlIfOurs(fileUrl: string): Promise<void> {
  const path = storageObjectPathFromCaseStudyUrl(fileUrl)
  if (!path) return
  const { error } = await getSupabase().storage.from(CLIENT_CASE_STUDIES_BUCKET).remove([path])
  if (error) console.error('Case study storage remove error:', error)
}

export async function removeCaseStudyByStoragePath(storagePath: string): Promise<void> {
  if (!storagePath) return
  const { error } = await getSupabase().storage.from(CLIENT_CASE_STUDIES_BUCKET).remove([storagePath])
  if (error) console.error('Case study storage remove error:', error)
}
