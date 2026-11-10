import { getSupabase } from '@/lib/supabase'
import { DISPUTE_LETTERS_BUCKET } from '@/lib/dispute-letters-storage'
import { disputeLettersFetch } from '@/lib/dispute-letters/api-client'
import type { LetterPacketAttachment } from '@/lib/dispute-letters/letter-identity-attachments'
import { hasSafeStoragePathSegments } from '@/lib/storage-utils'

const SESSION_ID = /^[0-9a-f-]{36}$/i

export type AccountEvidenceRecord = {
  count: number
  missing: boolean
}

export function safeEvidenceLetterId(letterId: string): string {
  return (letterId || '').replace(/[^a-zA-Z0-9-]/g, '')
}

export function accountEvidenceManifestPath(sessionId: string, letterId: string): string {
  return `sessions/${sessionId}/letters/${safeEvidenceLetterId(letterId)}/evidence/manifest.json`
}

/** A stored letter PDF is reused only after an evidence attempt has been recorded. */
export function storedLetterNeedsRebuild(record: AccountEvidenceRecord | null): boolean {
  return record == null
}

export function letterIdFromStoredPdfPath(sessionId: string, storagePath: string): string | null {
  const prefix = `sessions/${sessionId}/letters/`
  if (!storagePath.startsWith(prefix) || !storagePath.toLowerCase().endsWith('.pdf')) return null
  const name = storagePath.slice(prefix.length, -'.pdf'.length)
  if (!name || name.includes('/')) return null
  return name
}

export function interpretAccountEvidenceBody(
  raw: string,
  ok: boolean
): { files: LetterPacketAttachment[]; missing: boolean } {
  if (!ok || /<!doctype|<html|just a moment|cloudflare/i.test(raw) || raw.trim().startsWith('<')) {
    return { files: [], missing: true }
  }
  try {
    const parsed = JSON.parse(raw) as { files?: Array<{ name?: string; jpeg_base64?: string }> }
    const files: LetterPacketAttachment[] = []
    for (const file of parsed.files || []) {
      const data = Buffer.from(file.jpeg_base64 || '', 'base64')
      if (data.length < 3 || data[0] !== 0xff || data[1] !== 0xd8) continue
      files.push({
        zipName: (file.name || `Account Evidence ${files.length + 1}.jpg`).replace(/[<>:"/\\|?*]/g, '-'),
        data: new Uint8Array(data),
        mimeType: 'image/jpeg',
      })
    }
    return { files, missing: false }
  } catch {
    return { files: [], missing: true }
  }
}

export async function fetchAccountEvidence(
  sessionId: string,
  letterId: string
): Promise<{ files: LetterPacketAttachment[]; missing: boolean }> {
  try {
    const res = await disputeLettersFetch(
      `/internal/letters/${sessionId}/${letterId}/account-evidence`,
      { signal: AbortSignal.timeout(60_000) }
    )
    const raw = await res.text()
    return interpretAccountEvidenceBody(raw, res.ok)
  } catch (error) {
    console.warn(
      'account evidence unavailable',
      letterId,
      error instanceof Error ? error.message : error
    )
    return { files: [], missing: true }
  }
}

export async function readAccountEvidenceRecord(
  sessionId: string,
  letterId: string
): Promise<AccountEvidenceRecord | null> {
  if (!SESSION_ID.test(sessionId)) return null
  const storagePath = accountEvidenceManifestPath(sessionId, letterId)
  if (!hasSafeStoragePathSegments(storagePath)) return null
  const { data, error } = await getSupabase().storage.from(DISPUTE_LETTERS_BUCKET).download(storagePath)
  if (error || !data) return null
  try {
    const parsed = JSON.parse(Buffer.from(await data.arrayBuffer()).toString('utf8')) as AccountEvidenceRecord
    if (typeof parsed?.count !== 'number' || typeof parsed?.missing !== 'boolean') return null
    return { count: parsed.count, missing: parsed.missing }
  } catch {
    return null
  }
}

export async function persistAccountEvidence(params: {
  sessionId: string
  letterId: string
  files: LetterPacketAttachment[]
  missing: boolean
}): Promise<void> {
  if (!SESSION_ID.test(params.sessionId)) return
  const letterKey = safeEvidenceLetterId(params.letterId)
  const bucket = getSupabase().storage.from(DISPUTE_LETTERS_BUCKET)
  if (!params.missing) {
    for (let index = 0; index < params.files.length; index += 1) {
      const storagePath = `sessions/${params.sessionId}/letters/${letterKey}/evidence/${index + 1}.jpg`
      if (!hasSafeStoragePathSegments(storagePath)) continue
      const { error } = await bucket.upload(storagePath, Buffer.from(params.files[index].data), {
        contentType: 'image/jpeg',
        upsert: true,
      })
      if (error) console.error('account evidence jpeg upload error:', error)
    }
  }
  const manifestPath = accountEvidenceManifestPath(params.sessionId, params.letterId)
  const body = JSON.stringify({
    count: params.missing ? 0 : params.files.length,
    missing: params.missing,
  } satisfies AccountEvidenceRecord)
  const { error } = await bucket.upload(manifestPath, Buffer.from(body), {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) console.error('account evidence manifest upload error:', error)
}
