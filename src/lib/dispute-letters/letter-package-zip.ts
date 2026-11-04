import { disputeLettersJson } from '@/lib/dispute-letters/api-client'
import { currentLetters } from '@/lib/dispute-letters/current-letters'
import { listDisputeSessionsForApplication, getDisputeSessionById } from '@/lib/dispute-letters/db'
import {
  getRoundNumberForSession,
  loadLetterPackageForSession,
  markLetterPackageZipBuilding,
  markLetterPackageZipFailed,
  markLetterPackageZipReady,
  recordLetterPackageDownload,
} from '@/lib/dispute-letters/dispute-lifecycle-db'
import {
  isLetterPackageZipReady,
  letterIdsSignature,
  letterPackageZipStatus,
  type LetterPackageRow,
  type LetterPackageZipStatus,
} from '@/lib/dispute-letters/dispute-lifecycle'
import {
  buildLetterZipFiles,
  fetchLetterDocxFilesForZip,
  loadLetterIdentityAttachments,
} from '@/lib/dispute-letters/letter-identity-attachments'
import { zipFiles } from '@/lib/dispute-letters/letter-zip'
import {
  buildLetterPackageZipObjectPath,
  disputeLetterRoundIndex,
  disputeLettersZipDownloadName,
  downloadDisputeLetterBytes,
  isValidLetterPackageZipStoragePath,
  removeDisputeReportObject,
  uploadLetterPackageZipBytes,
} from '@/lib/dispute-letters-storage'

type LetterListItem = { id: string; title?: string; plan_id?: string }

export type BuiltLetterPackageZip = {
  buffer: Buffer
  filename: string
  letterIds: string[]
  letterCount: number
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

async function listCurrentLetters(sessionId: string): Promise<LetterListItem[]> {
  const payload = await disputeLettersJson<{ letters: LetterListItem[] }>(`/internal/letters/${sessionId}`)
  return currentLetters(payload.letters || [])
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

/** Build the DOCX+enclosure ZIP bytes for a session (same payload Download ZIP serves). */
export async function buildLetterPackageZipBytes(sessionId: string): Promise<BuiltLetterPackageZip> {
  const letters = await listCurrentLetters(sessionId)
  if (!letters.length) {
    throw new Error('No letters')
  }

  const row = await getDisputeSessionById(sessionId)
  const attachments = await loadLetterIdentityAttachments(row?.application_uuid)
  const letterFiles = await fetchLetterDocxFilesForZip(sessionId, letters, attachments)
  const files = buildLetterZipFiles(letterFiles)
  const buffer = zipFiles(files)
  const filename = await resolveZipDownloadFilename(sessionId)
  return {
    buffer,
    filename,
    letterIds: letters.map((letter) => letter.id),
    letterCount: letters.length,
  }
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

/** Load a ready prebuilt ZIP from storage when it matches current letters. */
export async function loadPrebuiltLetterPackageZip(
  sessionId: string,
  letterIds?: string[]
): Promise<{ buffer: Buffer; filename: string; packageId: string } | null> {
  const snapshot = await loadLetterPackageForSession(sessionId)
  const pkg = snapshot.package?.package || null
  if (!pkg?.id || !isLetterPackageZipReady(pkg) || !pkg.zip_storage_path) return null

  const ids = letterIds || (await listCurrentLetters(sessionId)).map((letter) => letter.id)
  if (!prebuiltZipMatchesLetters(pkg, ids)) return null
  if (!isValidLetterPackageZipStoragePath(pkg.zip_storage_path, sessionId)) return null

  const buffer = await downloadDisputeLetterBytes(pkg.zip_storage_path)
  if (!buffer?.length) return null

  const filename = await resolveZipDownloadFilename(sessionId)
  return { buffer, filename, packageId: pkg.id }
}

/**
 * Build the letters ZIP, upload to Supabase Storage, and mark the package ready.
 * Idempotent when a matching ready ZIP already exists.
 */
export async function prepareLetterPackageZip(sessionId: string): Promise<PrepareLetterPackageZipResult> {
  const snapshot = await loadLetterPackageForSession(sessionId)
  let pkg = snapshot.package?.package || null

  let letters: LetterListItem[]
  try {
    letters = await listCurrentLetters(sessionId)
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

  const buildingSameSet =
    pkg?.zip_status === 'building' &&
    (pkg.zip_letter_ids || '') === letterIdsSignature(letterIds) &&
    Date.parse(pkg.updated_at || '') > Date.now() - 3 * 60 * 1000
  if (buildingSameSet && pkg?.id) {
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

  const previousPath = pkg.zip_storage_path || null
  const storagePath = buildLetterPackageZipObjectPath(sessionId, pkg.id, pkg.version || 1)

  try {
    const built = await buildLetterPackageZipBytes(sessionId)
    const uploaded = await uploadLetterPackageZipBytes({
      storagePath,
      bytes: built.buffer,
    })
    if (!uploaded.ok) {
      await markLetterPackageZipFailed(pkg.id, uploaded.error)
      return {
        ok: false,
        status: 'failed',
        error: uploaded.error,
        packageId: pkg.id,
      }
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
      fromCache: false,
      storagePath,
      byteSize: built.buffer.length,
      packageId: pkg.id,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ZIP build failed'
    await markLetterPackageZipFailed(pkg.id, message)
    return { ok: false, status: 'failed', error: message, packageId: pkg.id }
  }
}

/**
 * Prefer a prebuilt ZIP; rebuild + persist when missing or stale.
 * Records the package download when bytes are returned.
 */
export async function getOrBuildLetterPackageZip(
  sessionId: string
): Promise<{ buffer: Buffer; filename: string; fromCache: boolean }> {
  const letters = await listCurrentLetters(sessionId)
  if (!letters.length) {
    throw new Error('No letters')
  }
  const letterIds = letters.map((letter) => letter.id)

  const prebuilt = await loadPrebuiltLetterPackageZip(sessionId, letterIds)
  if (prebuilt) {
    try {
      await recordLetterPackageDownload(sessionId)
    } catch (hookErr) {
      console.error('recordLetterPackageDownload hook failed:', hookErr)
    }
    return { buffer: prebuilt.buffer, filename: prebuilt.filename, fromCache: true }
  }

  const prepared = await prepareLetterPackageZip(sessionId)
  if (prepared.ok && prepared.storagePath) {
    const buffer = await downloadDisputeLetterBytes(prepared.storagePath)
    if (buffer?.length) {
      try {
        await recordLetterPackageDownload(sessionId)
      } catch (hookErr) {
        console.error('recordLetterPackageDownload hook failed:', hookErr)
      }
      const filename = await resolveZipDownloadFilename(sessionId)
      return { buffer, filename, fromCache: Boolean(prepared.fromCache) }
    }
  }

  // Last-resort in-memory rebuild if storage write failed but letters exist.
  const built = await buildLetterPackageZipBytes(sessionId)
  try {
    await recordLetterPackageDownload(sessionId)
  } catch (hookErr) {
    console.error('recordLetterPackageDownload hook failed:', hookErr)
  }
  return { buffer: built.buffer, filename: built.filename, fromCache: false }
}

export function zipReadyLabel(status: LetterPackageZipStatus | null | undefined, zipReady: boolean): string {
  if (zipReady || status === 'ready') return 'ZIP ready'
  if (status === 'building') return 'Preparing ZIP…'
  if (status === 'failed') return 'ZIP needs rebuild'
  return 'Preparing ZIP…'
}

export { letterPackageZipStatus, isLetterPackageZipReady }
