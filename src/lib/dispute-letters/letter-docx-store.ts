import { getSupabase } from '@/lib/supabase'
import { currentLetters } from '@/lib/dispute-letters/current-letters'
import type { LetterPackageRow } from '@/lib/dispute-letters/dispute-lifecycle'
import {
  buildStoredLetterDocxPath,
  isStoredLetterDocxPath,
  type LetterDocxSource,
} from '@/lib/dispute-letters/letter-docx-cache'
import { isDocxBytes } from '@/lib/dispute-letters/letter-zip'
import { DISPUTE_LETTERS_BUCKET, downloadDisputeLetterBytes } from '@/lib/dispute-letters-storage'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export type StoredZipLetter = LetterDocxSource & {
  plan_id?: string
  created_at?: string
}

/** Letter rows for ZIP assembly. Null when the query failed (caller may fall back). */
export async function listLetterRowsForZip(sessionId: string): Promise<StoredZipLetter[] | null> {
  const { data, error } = await getSupabase()
    .from('dispute_letters')
    .select('id, plan_id, title, storage_path, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('listLetterRowsForZip error:', error)
    return null
  }
  return currentLetters((data || []) as StoredZipLetter[])
}

export async function loadActiveLetterPackageZipRow(sessionId: string): Promise<LetterPackageRow | null> {
  const { data, error } = await getSupabase()
    .from('dispute_letter_packages')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) {
    if (error) console.error('loadActiveLetterPackageZipRow error:', error)
    return null
  }
  return data as LetterPackageRow
}

export async function readStoredLetterBytes(storagePath: string): Promise<Uint8Array | null> {
  const buf = await downloadDisputeLetterBytes(storagePath)
  if (!buf?.length) return null
  const data = new Uint8Array(buf)
  return isDocxBytes(data) ? data : null
}

export async function readStoredLetterDocxForSession(
  sessionId: string,
  letterId: string
): Promise<Uint8Array | null> {
  const { data, error } = await getSupabase()
    .from('dispute_letters')
    .select('id, storage_path')
    .eq('session_id', sessionId)
    .eq('id', letterId)
    .maybeSingle()
  if (error || !data) return null
  const storagePath = (data.storage_path as string | null) || ''
  if (!isStoredLetterDocxPath(sessionId, storagePath)) return null
  return readStoredLetterBytes(storagePath)
}

/** Upload a generated Word file and point the letter row at it so the next ZIP skips the generator. */
export async function storeGeneratedLetterDocx(params: {
  sessionId: string
  letterId: string
  data: Uint8Array
}): Promise<string | null> {
  if (!isDocxBytes(params.data)) return null
  const storagePath = buildStoredLetterDocxPath(params.sessionId, params.letterId)
  if (!isStoredLetterDocxPath(params.sessionId, storagePath)) return null

  const { error } = await getSupabase()
    .storage.from(DISPUTE_LETTERS_BUCKET)
    .upload(storagePath, Buffer.from(params.data), {
      contentType: DOCX_MIME,
      upsert: true,
    })
  if (error) {
    console.error('storeGeneratedLetterDocx upload error:', error)
    return null
  }

  const updated = await getSupabase()
    .from('dispute_letters')
    .update({ storage_path: storagePath })
    .eq('id', params.letterId)
    .eq('session_id', params.sessionId)
  if (updated.error) {
    console.error('storeGeneratedLetterDocx row update error:', updated.error)
  }
  return storagePath
}
