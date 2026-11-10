import { getSupabase } from '@/lib/supabase'
import { downloadDisputeLetterBytes } from '@/lib/dispute-letters-storage'
import type { LetterPacketAttachment } from '@/lib/dispute-letters/letter-identity-attachments'
import { hasSafeStoragePathSegments } from '@/lib/storage-utils'

const SESSION_ID = /^[0-9a-f-]{36}$/i

export type SessionEvidencePage = {
  page: number
  bureau: string
  tradelineId: string
  path: string
  account?: string
}

export type SessionEvidenceManifest = {
  attempted: boolean
  missing: boolean
  pages: SessionEvidencePage[]
}

export type EvidenceLetterItem = {
  tradeline_id?: string
  tradelineId?: string
}

export function sessionEvidenceManifestPath(sessionId: string): string {
  return `sessions/${sessionId}/evidence/manifest.json`
}

export function letterBureauFromType(letterType: string | null | undefined): 'TUC' | 'EXP' | 'EQF' | null {
  if (letterType === 'bureau_transunion') return 'TUC'
  if (letterType === 'bureau_experian') return 'EXP'
  if (letterType === 'bureau_equifax') return 'EQF'
  return null
}

function isSessionEvidenceJpeg(sessionId: string, storagePath: string): boolean {
  const prefix = `sessions/${sessionId}/evidence/`
  if (!storagePath.startsWith(prefix) || !storagePath.toLowerCase().endsWith('.jpg')) return false
  if (storagePath.includes('..')) return false
  return hasSafeStoragePathSegments(storagePath)
}

export function evidencePagesForLetter(
  manifest: SessionEvidenceManifest | null,
  items: EvidenceLetterItem[],
  letterBureau: string | null
): SessionEvidencePage[] {
  if (!manifest?.pages?.length) return []
  const ids = new Set(
    items.map((item) => item.tradeline_id || item.tradelineId || '').filter((id) => id.length > 0)
  )
  if (!ids.size) return []
  const seen = new Set<string>()
  const pages: SessionEvidencePage[] = []
  for (const page of manifest.pages) {
    if (!page?.path || !page.tradelineId || !ids.has(page.tradelineId)) continue
    if (letterBureau && page.bureau && page.bureau !== letterBureau) continue
    if (seen.has(page.path)) continue
    seen.add(page.path)
    pages.push(page)
  }
  return pages
}

/** A stored letter PDF is kept. A missing manifest must not start another render. */
export function storedLetterNeedsRebuild(_record: { attempted?: boolean } | null): boolean {
  return false
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

export async function readSessionEvidenceManifest(sessionId: string): Promise<SessionEvidenceManifest | null> {
  if (!SESSION_ID.test(sessionId)) return null
  const storagePath = sessionEvidenceManifestPath(sessionId)
  if (!hasSafeStoragePathSegments(storagePath)) return null
  const data = await downloadDisputeLetterBytes(storagePath)
  if (!data?.length) return null
  try {
    const parsed = JSON.parse(data.toString('utf8')) as {
      attempted?: boolean
      missing?: boolean
      pages?: Array<{
        page?: number
        bureau?: string
        tradeline_id?: string
        tradelineId?: string
        path?: string
        account?: string
      }>
    }
    if (parsed?.attempted !== true) return null
    const pages: SessionEvidencePage[] = []
    for (const page of parsed.pages || []) {
      const path = page.path || ''
      const tradelineId = page.tradeline_id || page.tradelineId || ''
      if (!isSessionEvidenceJpeg(sessionId, path) || !tradelineId) continue
      pages.push({
        page: Number(page.page) || 0,
        bureau: page.bureau || '',
        tradelineId,
        path,
        account: page.account,
      })
    }
    return { attempted: true, missing: Boolean(parsed.missing), pages }
  } catch {
    return null
  }
}

export async function loadStoredEvidenceAttachments(
  sessionId: string,
  items: EvidenceLetterItem[],
  letterType: string | null | undefined
): Promise<LetterPacketAttachment[]> {
  const manifest = await readSessionEvidenceManifest(sessionId)
  const pages = evidencePagesForLetter(manifest, items, letterBureauFromType(letterType))
  const files: LetterPacketAttachment[] = []
  for (const page of pages) {
    const data = await downloadDisputeLetterBytes(page.path)
    if (!data || data.length < 3 || data[0] !== 0xff || data[1] !== 0xd8) continue
    files.push({
      zipName: `Account Evidence ${files.length + 1}.jpg`,
      data: new Uint8Array(data),
      mimeType: 'image/jpeg',
    })
  }
  return files
}

export async function loadLetterPlanForEvidence(
  sessionId: string,
  planId: string
): Promise<{ letter_type?: string; items?: EvidenceLetterItem[] } | null> {
  if (!SESSION_ID.test(sessionId) || !planId) return null
  const { data, error } = await getSupabase()
    .from('dispute_letter_plans')
    .select('plans_json')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (error || !data) return null
  const plans = Array.isArray(data.plans_json) ? data.plans_json : []
  const plan = plans.find((row) => row && typeof row === 'object' && (row as { id?: string }).id === planId) as
    | { letter_type?: string; items?: EvidenceLetterItem[] }
    | undefined
  return plan || null
}
