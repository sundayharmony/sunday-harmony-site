import { checkDisputeLettersHealth, disputeLettersJson } from '@/lib/dispute-letters/api-client'
import { currentLetters } from '@/lib/dispute-letters/current-letters'
import { listDisputeSessionsForApplication, getDisputeSessionById } from '@/lib/dispute-letters/db'
import {
  getRoundNumberForSession,
  loadLetterPackageForSession,
  markLetterPackageZipBuilding,
  markLetterPackageZipFailed,
  markLetterPackageZipReady,
  recordLetterPackageDownload,
  touchLetterPackageZipBuild,
} from '@/lib/dispute-letters/dispute-lifecycle-db'
import {
  isLetterPackageZipReady,
  letterIdsSignature,
  letterPackageZipStatus,
  type LetterPackageRow,
  type LetterPackageZipStatus,
} from '@/lib/dispute-letters/dispute-lifecycle'
import {
  assembleLetterDocxFiles,
  isStoredLetterDocxPath,
  isZipBuildInFlight,
  type LetterDocxSource,
} from '@/lib/dispute-letters/letter-docx-cache'
import {
  listLetterRowsForZip,
  loadActiveLetterPackageZipRow,
  readStoredLetterBytes,
  storeGeneratedLetterDocx,
  type StoredZipLetter,
} from '@/lib/dispute-letters/letter-docx-store'
import {
  buildLetterZipFiles,
  fetchLetterPdfForPackageZip,
} from '@/lib/dispute-letters/letter-identity-attachments'
import { zipFiles } from '@/lib/dispute-letters/letter-zip'
import {
  buildLetterPackageZipObjectPath,
  disputeLetterRoundIndex,
  disputeLettersZipDownloadName,
  downloadDisputeLetterBytes,
  getDisputeLetterSignedDownloadUrl,
  isValidLetterPackageZipStoragePath,
  removeDisputeReportObject,
  uploadLetterPackageZipBytes,
} from '@/lib/dispute-letters-storage'

type LetterListItem = { id: string; title?: string; plan_id?: string; storage_path?: string | null }

export type BuiltLetterPackageZip = {
  buffer: Buffer
  filename: string
  letterIds: string[]
  letterCount: number
  /** Letters that had to be generated because no stored Word file existed. */
  generatedCount: number
}

export type PrepareLetterPackageZipResult = {
  ok: boolean
  status: LetterPackageZipStatus
  fromCache?: boolean
  storagePath?: string | null
  byteSize?: number
  error?: string
  packageId?: string
}

const READY_ZIP_WAIT_MS = 90_000

async function listCurrentLetters(sessionId: string): Promise<LetterListItem[]> {
  const payload = await disputeLettersJson<{ letters: LetterListItem[] }>(`/internal/letters/${sessionId}`)
  return currentLetters(payload.letters || [])
}

/** Current letters from Supabase, including each stored DOCX path. Falls back to the API only if the query fails. */
export async function listZipLetters(sessionId: string): Promise<StoredZipLetter[]> {
  const stored = await listLetterRowsForZip(sessionId)
  if (stored) return currentLetters(stored)
  const remote = await listCurrentLetters(sessionId)
  return currentLetters(
    remote.map((letter) => ({
      id: letter.id,
      plan_id: letter.plan_id,
      title: letter.title,
      storage_path: letter.storage_path || null,
    }))
  )
}

export async function resolveZipDownloadFilename(sessionId: string): Promise<string> {
  const row = await getDisputeSessionById(sessionId)
  let round = (await getRoundNumberForSession(sessionId)) || 0
  if (!round && row?.application_uuid) {
    const sessions = await listDisputeSessionsForApplication(row.application_uuid)
    round = disputeLetterRoundIndex(sessions, sessionId)
  }
  if (!round) round = 1
  return disputeLettersZipDownloadName(row?.report_json?.consumer?.name, round)
}

function packageLetterSignature(pkg: LetterPackageRow | null | undefined, fallbackIds: string[]): string {
  const fromPkg = (pkg?.zip_letter_ids || '').trim()
  if (fromPkg) return fromPkg
  return letterIdsSignature(fallbackIds)
}

/**
 * True when the stored ZIP matches the current letter set and is marked ready.
 * Used by download to short-circuit expensive rebuilds.
 */
export function prebuiltZipMatchesLetters(
  pkg: LetterPackageRow | null | undefined,
  letterIds: string[]
): boolean {
  if (!isLetterPackageZipReady(pkg)) return false
  const expected = letterIdsSignature(letterIds)
  const stored = packageLetterSignature(pkg, [])
  return Boolean(expected) && expected === stored
}

async function safeRecordDownload(sessionId: string): Promise<void> {
  try {
    await recordLetterPackageDownload(sessionId)
  } catch (hookErr) {
    console.error('recordLetterPackageDownload hook failed:', hookErr)
  }
}

function lettersNeedGenerator(sessionId: string, letters: readonly LetterDocxSource[]): boolean {
  return letters.some((letter) => !isStoredLetterDocxPath(sessionId, letter.storage_path))
}

/** Build the DOCX ZIP from stored Word files, generating only letters that are not already in storage. */
export async function buildLetterPackageZipBytes(
  sessionId: string,
  letters?: StoredZipLetter[]
): Promise<BuiltLetterPackageZip> {
  const rows = letters || (await listZipLetters(sessionId))
  if (!rows.length) {
    throw new Error('No letters')
  }

  let generatedCount = 0

  const letterFiles = await assembleLetterDocxFiles({
    sessionId,
    letters: rows,
    readStored: (storagePath) => readStoredLetterBytes(storagePath),
    generateMissing: async (letter) => {
      generatedCount += 1
      try {
        // Letter + identity only. Account screenshots OOM/timeout the free-tier API and
        // cause Vercel prepare-zip to mark the package failed after a multi-minute wait.
        const data = await fetchLetterPdfForPackageZip(sessionId, letter.id)
        await storeGeneratedLetterDocx({ sessionId, letterId: letter.id, data })
        return data
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'download failed'
        throw new Error(`Letter "${letter.title || letter.id}" failed to download: ${detail}`)
      }
    },
  })
  const files = buildLetterZipFiles(letterFiles).filter((file) => file.name.toLowerCase().endsWith('.pdf'))
  if (files.length !== rows.length) {
    throw new Error('ZIP is missing a letter file')
  }
  const buffer = zipFiles(files)
  const filename = await resolveZipDownloadFilename(sessionId)
  return {
    buffer,
    filename,
    letterIds: rows.map((letter) => letter.id),
    letterCount: rows.length,
    generatedCount,
  }
}

async function downloadReadyZip(
  sessionId: string,
  pkg: LetterPackageRow
): Promise<{ buffer: Buffer; filename: string; packageId: string } | null> {
  if (!pkg.zip_storage_path) return null
  const buffer = await downloadDisputeLetterBytes(pkg.zip_storage_path)
  if (!buffer?.length) return null
  const filename = await resolveZipDownloadFilename(sessionId)
  return { buffer, filename, packageId: pkg.id }
}

/** Load a ready prebuilt ZIP from storage when it matches current letters. */
export async function loadPrebuiltLetterPackageZip(
  sessionId: string,
  letterIds?: string[]
): Promise<{ buffer: Buffer; filename: string; packageId: string } | null> {
  const ids = letterIds || (await listZipLetters(sessionId)).map((letter) => letter.id)
  const pkg = await loadActiveLetterPackageZipRow(sessionId)
  if (!pkg?.id || !prebuiltZipMatchesLetters(pkg, ids)) return null
  if (!isValidLetterPackageZipStoragePath(pkg.zip_storage_path || '', sessionId)) return null
  return downloadReadyZip(sessionId, pkg)
}

/**
 * Stream a ready package ZIP straight from storage.
 * Does not list letters through the generator or rebuild Word files.
 */
export async function openReadyLetterPackageZip(sessionId: string): Promise<{
  stream: ReadableStream<Uint8Array>
  filename: string
  byteSize?: number
} | null> {
  const letters = await listZipLetters(sessionId)
  if (!letters.length) return null
  const letterIds = letters.map((letter) => letter.id)
  const pkg = await loadActiveLetterPackageZipRow(sessionId)
  if (!pkg?.zip_storage_path || !prebuiltZipMatchesLetters(pkg, letterIds)) return null
  if (!isValidLetterPackageZipStoragePath(pkg.zip_storage_path, sessionId)) return null

  const signedUrl = await getDisputeLetterSignedDownloadUrl(pkg.zip_storage_path, 120)
  if (!signedUrl) return null
  const upstream = await fetch(signedUrl)
  if (!upstream.ok || !upstream.body) return null

  await safeRecordDownload(sessionId)
  return {
    stream: upstream.body,
    filename: await resolveZipDownloadFilename(sessionId),
    byteSize: pkg.zip_byte_size || undefined,
  }
}

async function persistBuiltPackageZip(
  sessionId: string,
  built: BuiltLetterPackageZip
): Promise<PrepareLetterPackageZipResult> {
  const snapshot = await loadLetterPackageForSession(sessionId)
  let pkg = snapshot.package?.package || null
  const claimed = await markLetterPackageZipBuilding(sessionId, built.letterIds)
  pkg = claimed || pkg
  if (!pkg?.id) {
    return { ok: false, status: 'failed', error: 'Letter package not found after generate' }
  }

  const previousPath = pkg.zip_storage_path || null
  const storagePath = buildLetterPackageZipObjectPath(sessionId, pkg.id, pkg.version || 1)
  const uploaded = await uploadLetterPackageZipBytes({ storagePath, bytes: built.buffer })
  if (!uploaded.ok) {
    await markLetterPackageZipFailed(pkg.id, uploaded.error)
    return { ok: false, status: 'failed', error: uploaded.error, packageId: pkg.id }
  }
  if (previousPath && previousPath !== storagePath) {
    await removeDisputeReportObject(previousPath).catch(() => undefined)
  }
  await markLetterPackageZipReady({
    packageId: pkg.id,
    storagePath,
    letterIds: built.letterIds,
    byteSize: built.buffer.length,
  })
  return {
    ok: true,
    status: 'ready',
    fromCache: built.generatedCount === 0,
    storagePath,
    byteSize: built.buffer.length,
    packageId: pkg.id,
  }
}

function startZipBuildHeartbeat(packageId: string): () => void {
  const timer = setInterval(() => {
    void touchLetterPackageZipBuild(packageId)
  }, 10_000)
  return () => clearInterval(timer)
}

async function waitForReadyLetterPackageZip(
  sessionId: string,
  letterIds: string[],
  timeoutMs: number
): Promise<{ buffer: Buffer; filename: string; packageId: string } | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const pkg = await loadActiveLetterPackageZipRow(sessionId)
    if (pkg && prebuiltZipMatchesLetters(pkg, letterIds) && pkg.zip_storage_path) {
      if (isValidLetterPackageZipStoragePath(pkg.zip_storage_path, sessionId)) {
        const loaded = await downloadReadyZip(sessionId, pkg)
        if (loaded) return loaded
      }
    }
    if (pkg?.zip_status === 'failed') return null
    if (pkg && !isZipBuildInFlight(pkg, letterIds) && !isLetterPackageZipReady(pkg)) return null
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return null
}

/**
 * Build the letters ZIP, upload to Supabase Storage, and mark the package ready.
 * Idempotent when a matching ready ZIP already exists.
 * Letters that already have a stored DOCX are not sent back through the generator.
 */
export async function prepareLetterPackageZip(sessionId: string): Promise<PrepareLetterPackageZipResult> {
  const snapshot = await loadLetterPackageForSession(sessionId)
  let pkg = snapshot.package?.package || null

  let letters: StoredZipLetter[]
  try {
    letters = await listZipLetters(sessionId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list letters'
    if (pkg?.id) await markLetterPackageZipFailed(pkg.id, message)
    return { ok: false, status: 'failed', error: message, packageId: pkg?.id }
  }

  if (!letters.length) {
    const message = 'No letters'
    if (pkg?.id) await markLetterPackageZipFailed(pkg.id, message)
    return { ok: false, status: 'failed', error: message, packageId: pkg?.id }
  }

  const letterIds = letters.map((letter) => letter.id)
  if (prebuiltZipMatchesLetters(pkg, letterIds) && pkg?.zip_storage_path) {
    return {
      ok: true,
      status: 'ready',
      fromCache: true,
      storagePath: pkg.zip_storage_path,
      byteSize: pkg.zip_byte_size || undefined,
      packageId: pkg.id,
    }
  }

  if (isZipBuildInFlight(pkg, letterIds) && pkg?.id) {
    return {
      ok: true,
      status: 'building',
      fromCache: false,
      packageId: pkg.id,
      storagePath: pkg.zip_storage_path,
    }
  }

  const claimed = await markLetterPackageZipBuilding(sessionId, letterIds)
  pkg = claimed || pkg
  if (!pkg?.id) {
    return { ok: false, status: 'failed', error: 'Letter package not found after generate' }
  }

  const stopHeartbeat = startZipBuildHeartbeat(pkg.id)
  try {
    if (lettersNeedGenerator(sessionId, letters)) {
      await checkDisputeLettersHealth(45_000).catch(() => false)
    }
    const built = await buildLetterPackageZipBytes(sessionId, letters)
    const persisted = await persistBuiltPackageZip(sessionId, built)
    return persisted
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ZIP build failed'
    await markLetterPackageZipFailed(pkg.id, message)
    return { ok: false, status: 'failed', error: message, packageId: pkg.id }
  } finally {
    stopHeartbeat()
  }
}

/**
 * Prefer a prebuilt ZIP or already-stored Word files.
 * Generates only letters that have never been saved, and does not start a second
 * build while another request is still heartbeating.
 */
export async function getOrBuildLetterPackageZip(sessionId: string): Promise<{
  buffer: Buffer
  filename: string
  fromCache: boolean
  /** Upload the package ZIP after the response starts. Undefined when already stored. */
  storePackage?: () => Promise<void>
}> {
  const letters = await listZipLetters(sessionId)
  if (!letters.length) {
    throw new Error('No letters')
  }
  const letterIds = letters.map((letter) => letter.id)

  const prebuilt = await loadPrebuiltLetterPackageZip(sessionId, letterIds)
  if (prebuilt) {
    await safeRecordDownload(sessionId)
    return { buffer: prebuilt.buffer, filename: prebuilt.filename, fromCache: true }
  }

  if (!lettersNeedGenerator(sessionId, letters)) {
    const built = await buildLetterPackageZipBytes(sessionId, letters)
    await safeRecordDownload(sessionId)
    return {
      buffer: built.buffer,
      filename: built.filename,
      fromCache: built.generatedCount === 0,
      storePackage: async () => {
        await persistBuiltPackageZip(sessionId, built)
      },
    }
  }

  const pkg = await loadActiveLetterPackageZipRow(sessionId)
  const inFlight = isZipBuildInFlight(pkg, letterIds)
  if (inFlight) {
    const waited = await waitForReadyLetterPackageZip(sessionId, letterIds, READY_ZIP_WAIT_MS)
    if (waited) {
      await safeRecordDownload(sessionId)
      return { buffer: waited.buffer, filename: waited.filename, fromCache: true }
    }
    // A second build would call the letter service again and make both run past the page timer.
    throw new Error('ZIP is still being prepared')
  }

  let ownBuild = !inFlight
  if (ownBuild) {
    const prepared = await prepareLetterPackageZip(sessionId)
    if (prepared.status === 'building') {
      ownBuild = false
    } else if (prepared.ok && prepared.status === 'ready' && prepared.storagePath) {
      const buffer = await downloadDisputeLetterBytes(prepared.storagePath)
      if (buffer?.length) {
        await safeRecordDownload(sessionId)
        const filename = await resolveZipDownloadFilename(sessionId)
        return { buffer, filename, fromCache: Boolean(prepared.fromCache) }
      }
    }
  }

  // Stored Word files still produce a ZIP when the package upload is missing.
  // Skip another package write while a different build is heartbeating.
  const built = await buildLetterPackageZipBytes(sessionId, letters)
  await safeRecordDownload(sessionId)
  return {
    buffer: built.buffer,
    filename: built.filename,
    fromCache: built.generatedCount === 0,
    storePackage: ownBuild
      ? async () => {
          await persistBuiltPackageZip(sessionId, built)
        }
      : undefined,
  }
}

export {
  letterPackageZipStatus,
  isLetterPackageZipReady,
  zipDownloadButtonLabel,
  zipReadyLabel,
} from '@/lib/dispute-letters/dispute-lifecycle'
export { isZipBuildInFlight, isStoredLetterDocxPath, assembleLetterDocxFiles } from '@/lib/dispute-letters/letter-docx-cache'
