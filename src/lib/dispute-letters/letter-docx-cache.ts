import { mapWithConcurrency } from '@/lib/dispute-letters/async-pool'
import { letterIdsSignature } from '@/lib/dispute-letters/dispute-lifecycle'
import { isPdfBytes } from '@/lib/dispute-letters/letter-zip'
import { hasSafeStoragePathSegments } from '@/lib/storage-utils'

/** Parallel storage reads when zipping letters that are already built. */
export const LETTER_DOCX_READ_CONCURRENCY = 6

/**
 * Parallel generator calls for letters that have no stored PDF yet.
 * Keep this at 1: each PDF pulls identity docs + report account screenshots through
 * the free-tier letters API, and concurrent builds OOM / stall "Preparing ZIP".
 */
export const LETTER_DOCX_GENERATE_CONCURRENCY = 1

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
  return `sessions/${sessionId}/letters/${safeLetter}.pdf`
}

/** True when this path is a PDF letter we stored for the session, not a local generator path or a .txt copy. */
export function isStoredLetterDocxPath(sessionId: string, storagePath: string | null | undefined): boolean {
  if (!storagePath || !SESSION_ID.test(sessionId)) return false
  if (!hasSafeStoragePathSegments(storagePath)) return false
  if (!storagePath.startsWith(`sessions/${sessionId}/letters/`)) return false
  if (!storagePath.toLowerCase().endsWith('.pdf')) return false
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
 * Zip inputs from stored PDF letters. Letters that already have a PDF in storage
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

  // Generate often leaves a local API path in storage_path. Always try the canonical
  // sessions/.../letters/{id}.pdf object first so a prior download/ZIP can skip rebuild.
  const readPaths = params.letters.map((letter) => {
    if (isStoredLetterDocxPath(params.sessionId, letter.storage_path)) {
      return letter.storage_path || ''
    }
    return buildStoredLetterDocxPath(params.sessionId, letter.id)
  })
  const storedIndexes = params.letters.map((_, index) => index)

  const failedReads: number[] = []
  await mapWithConcurrency(storedIndexes, readConcurrency, async (index) => {
    const letter = params.letters[index]
    const data = await params.readStored(readPaths[index])
    if (data?.length && isPdfBytes(data)) {
      results[index] = { title: letter.title || letter.id, data }
      return
    }
    failedReads.push(index)
  })

  await mapWithConcurrency(failedReads, LETTER_DOCX_GENERATE_CONCURRENCY, async (index) => {
    const letter = params.letters[index]
    const data = await params.generateMissing(letter)
    if (!isPdfBytes(data)) {
      throw new Error(`Letter "${letter.title || letter.id}" was not a PDF`)
    }
    results[index] = { title: letter.title || letter.id, data }
  })

  return results
}
