import { randomUUID } from 'crypto'
import { CLIENT_CASE_STUDIES_BUCKET, CASE_STUDY_PDF_MAX_BYTES } from '@/lib/case-study-constants'
import { effectiveContentType, scanPdfBuffer } from '@/lib/storage-utils'
import { getSupabase } from '@/lib/supabase'

export { CLIENT_CASE_STUDIES_BUCKET, CASE_STUDY_PDF_MAX_BYTES } from '@/lib/case-study-constants'

const PDF_MIME = 'application/pdf'

export function sanitizeCaseStudyFileName(original: string): string {
  const base = original.replace(/^.*[/\\]/, '').trim() || 'case-study.pdf'
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
  return cleaned || 'case-study.pdf'
}

export function buildCaseStudyObjectPath(originalFileName: string): string {
  return `uploads/${randomUUID()}_${sanitizeCaseStudyFileName(originalFileName)}`
}

export function getCaseStudyPublicUrl(objectPath: string): string | null {
  const { data: pub } = getSupabase().storage.from(CLIENT_CASE_STUDIES_BUCKET).getPublicUrl(objectPath)
  return pub?.publicUrl || null
}

export function getCaseStudyPdfRoute(id: string): string {
  return `/api/case-studies/${encodeURIComponent(id)}/pdf`
}

export async function getCaseStudySignedUrl(
  storagePath: string,
  expiresInSeconds = 10 * 60
): Promise<string | null> {
  if (!isValidCaseStudyStoragePath(storagePath)) return null
  const { data, error } = await getSupabase()
    .storage
    .from(CLIENT_CASE_STUDIES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error || !data?.signedUrl) {
    console.error('Case study signed URL error:', error)
    return null
  }
  return data.signedUrl
}

const CASE_STUDY_UPLOAD_PATH_RE = /^uploads\/[0-9a-f-]{36}_[a-zA-Z0-9._-]+$/

export function isValidCaseStudyStoragePath(storagePath: string): boolean {
  return CASE_STUDY_UPLOAD_PATH_RE.test(storagePath)
}

export interface CaseStudySignedUpload {
  signedUrl: string
  path: string
  token: string
}

export async function createCaseStudySignedUploadUrl(params: {
  originalFileName: string
  contentType: string
  fileSize: number
}): Promise<{ ok: true; data: CaseStudySignedUpload } | { ok: false; error: string }> {
  const effective = effectiveContentType(params.contentType, params.originalFileName)
  const v = validateCaseStudyPdf(effective, params.fileSize)
  if (!v.ok) return { ok: false, error: v.error }

  const objectPath = buildCaseStudyObjectPath(params.originalFileName)
  const supabase = getSupabase()
  const bucket = supabase.storage.from(CLIENT_CASE_STUDIES_BUCKET)
  const signed = await bucket.createSignedUploadUrl(objectPath)

  if (signed.error || !signed.data?.signedUrl || !signed.data?.token) {
    console.error('Case study signed upload URL error:', signed.error)
    return { ok: false, error: signed.error?.message || 'Could not create upload URL' }
  }

  return {
    ok: true,
    data: {
      signedUrl: signed.data.signedUrl,
      path: signed.data.path || objectPath,
      token: signed.data.token,
    },
  }
}

export async function verifyCaseStudyObject(
  storagePath: string,
  expectedSize: number
): Promise<{ ok: true; fileSize: number } | { ok: false; error: string }> {
  if (!isValidCaseStudyStoragePath(storagePath)) {
    return { ok: false, error: 'Invalid storagePath' }
  }
  const { data, error } = await getSupabase()
    .storage.from(CLIENT_CASE_STUDIES_BUCKET)
    .download(storagePath)
  if (error) {
    if (error.message?.toLowerCase().includes('not found') || (error as { statusCode?: string }).statusCode === '404') {
      return { ok: false, error: 'Uploaded file not found in storage' }
    }
    console.error('Case study storage verification error:', error)
    return { ok: false, error: 'Could not verify uploaded file' }
  }
  if (!data) return { ok: false, error: 'Uploaded file not found in storage' }

  const buffer = Buffer.from(await data.arrayBuffer())
  const validation = validateCaseStudyPdf(PDF_MIME, buffer.length)
  if (!validation.ok) return validation
  if (buffer.length !== expectedSize) {
    return { ok: false, error: 'Uploaded file size does not match the signed upload request' }
  }

  const scan = scanPdfBuffer(buffer)
  if (!scan.ok) return { ok: false, error: scan.reason }
  return { ok: true, fileSize: buffer.length }
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
  const scan = scanPdfBuffer(buffer)
  if (!scan.ok) return { ok: false, error: scan.reason }

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
