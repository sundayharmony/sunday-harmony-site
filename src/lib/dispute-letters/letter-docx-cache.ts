import { mapWithConcurrency } from '@/lib/dispute-letters/async-pool'
import { letterIdsSignature } from '@/lib/dispute-letters/dispute-lifecycle'
import { isDocxBytes } from '@/lib/dispute-letters/letter-zip'
import { hasSafeStoragePathSegments } from '@/lib/storage-utils'

/** Parallel storage reads when zipping letters that are already built. */
export const LETTER_DOCX_READ_CONCURRENCY = 6

/** Parallel generator calls for letters that have no stored Word file yet. */
export const LETTER_DOCX_GENERATE_CONCURRENCY = 4

/**
 * How long a ZIP build may stay quiet before another request takes over.
 * The builder heartbeats `updated_at` while it runs, so a live build stays inside this window.
 * A pre-marked "building" row that never started work goes stale and no longer blocks download.
 */
export const ZIP_BUILD_JOIN_MS = 30_000

const SESSION_ID = /^[0-9a-f-]{36}$/i

export type LetterDocxSource = {
  id: string
  title?: string
  storage_path?: string | null
}

export type ZipBuildClaimRow = {
  zip_status?: string | null
  zip_letter_ids?: string | null
  updated_at?: string | null
}

export function buildStoredLetterDocxPath(sessionId: string, letterId: string): string {
  const safeLetter = (letterId || '').replace(/[^a-zA-Z0-9-]/g, '')
  return `sessions/${sessionId}/letters/${safeLetter}.docx`
}

/** True when this path is a Word file we stored for the session, not a local generator path or a .txt copy. */
export function isStoredLetterDocxPath(sessionId: string, storagePath: string | null | undefined): boolean {
  if (!storagePath || !SESSION_ID.test(sessionId)) return false
  if (!hasSafeStoragePathSegments(storagePath)) return false
  if (!storagePath.startsWith(`sessions/${sessionId}/letters/`)) return false
  if (!storagePath.toLowerCase().endsWith('.docx')) return false
  return storagePath.split('/').length === 4
}

export function isZipBuildInFlight(
  pkg: ZipBuildClaimRow | null | undefined,
  letterIds: string[],
  now = Date.now(),
  joinMs = ZIP_BUILD_JOIN_MS
): boolean {
  if (!pkg || pkg.zip_status !== 'building') return false
  const expected = letterIdsSignature(letterIds)
  if (!expected || (pkg.zip_letter_ids || '') !== expected) return false
  const updated = Date.parse(pkg.updated_at || '')
  return Number.isFinite(updated) && updated > now - joinMs
}

/**
 * Zip inputs from stored Word files. Letters that already have a DOCX in storage
 * are read with bounded concurrency and never passed to `generateMissing`.
 */
export async function assembleLetterDocxFiles(
  params: {
    sessionId: string
    letters: readonly LetterDocxSource[]
    concurrency?: number
    readStored: (storagePath: string) => Promise<Uint8Array | null>
    generateMissing: (letter: LetterDocxSource) => Promise<Uint8Array>
  }
): Promise<{ title: string; data: Uint8Array }[]> {
  const readConcurrency = Math.max(1, params.concurrency ?? LETTER_DOCX_READ_CONCURRENCY)
  const results = new Array<{ title: string; data: Uint8Array }>(params.letters.length)
  const storedIndexes: number[] = []
  const missingIndexes: number[] = []

  params.letters.forEach((letter, index) => {
    if (isStoredLetterDocxPath(params.sessionId, letter.storage_path)) storedIndexes.push(index)
    else missingIndexes.push(index)
  })

  const failedReads: number[] = []
  await mapWithConcurrency(storedIndexes, readConcurrency, async (index) => {
    const letter = params.letters[index]
    const data = await params.readStored(letter.storage_path || '')
    if (data?.length && isDocxBytes(data)) {
      results[index] = { title: letter.title || letter.id, data }
      return
    }
    failedReads.push(index)
  })

  const toGenerate = [...missingIndexes, ...failedReads]
  await mapWithConcurrency(toGenerate, LETTER_DOCX_GENERATE_CONCURRENCY, async (index) => {
    const letter = params.letters[index]
    const data = await params.generateMissing(letter)
    if (!isDocxBytes(data)) {
      throw new Error(`Letter "${letter.title || letter.id}" was not a Word document`)
    }
    results[index] = { title: letter.title || letter.id, data }
  })

  return results
}
