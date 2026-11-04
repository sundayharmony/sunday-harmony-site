import { getDocumentsByApplicationUuid } from '@/lib/credit-funding-db'
import { downloadCreditFundingDocument } from '@/lib/credit-funding-storage'
import { disputeLettersFetch, disputeLettersFetchForm } from '@/lib/dispute-letters/api-client'
import { mapWithConcurrency, withRetries } from '@/lib/dispute-letters/async-pool'
import { isDocxBytes, uniqueDocxFilename, uniqueZipFilename } from '@/lib/dispute-letters/letter-zip'

export type LetterIdentityDoc = {
  id: string
  document_type: string
  storage_path: string
  file_name: string
  mime_type?: string | null
  scan_status?: string | null
}

export type LetterIdentityPicks = {
  photoIds: LetterIdentityDoc[]
  proofOfAddress: LetterIdentityDoc | null
}

export type LetterPacketAttachment = {
  zipName: string
  data: Uint8Array
  mimeType?: string
}

const PHOTO_ID_STEM = 'Government Photo ID'
const ADDRESS_STEM = 'Proof of Address'

/** Concurrent letter DOCX builds against the Python API (ZIP package). */
export const LETTER_DOCX_FETCH_CONCURRENCY = 4

function isUsableIdentityDoc(doc: LetterIdentityDoc): boolean {
  return doc.scan_status !== 'rejected' && Boolean(doc.storage_path)
}

export function pickLetterIdentityDocuments(docs: LetterIdentityDoc[]): LetterIdentityPicks {
  const usable = docs.filter(isUsableIdentityDoc)
  const photoIds = usable.filter((doc) => doc.document_type === 'photo_id')
  const proofOfAddress =
    usable.find((doc) => doc.document_type === 'proof_of_address') ||
    usable.find((doc) => doc.document_type === 'mail_proof') ||
    null
  return { photoIds, proofOfAddress }
}

export function selectedLetterIdentityDocuments(docs: LetterIdentityDoc[]): LetterIdentityDoc[] {
  const picked = pickLetterIdentityDocuments(docs)
  return [...picked.photoIds, ...(picked.proofOfAddress ? [picked.proofOfAddress] : [])]
}

function extensionForIdentityDoc(doc: LetterIdentityDoc): string {
  const fromName = doc.file_name.includes('.')
    ? doc.file_name.slice(doc.file_name.lastIndexOf('.') + 1).toLowerCase().replace(/[^a-z0-9]/g, '')
    : ''
  if (fromName) return fromName
  const mime = (doc.mime_type || '').split(';')[0].trim().toLowerCase()
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg'
  return 'bin'
}

function mimeForIdentityDoc(doc: LetterIdentityDoc): string {
  const mime = (doc.mime_type || '').split(';')[0].trim().toLowerCase()
  if (mime) return mime
  const ext = extensionForIdentityDoc(doc)
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  return 'application/octet-stream'
}

function stemForIdentityDoc(doc: LetterIdentityDoc): string {
  if (doc.document_type === 'photo_id') return PHOTO_ID_STEM
  if (doc.document_type === 'proof_of_address' || doc.document_type === 'mail_proof') return ADDRESS_STEM
  return 'Identity Document'
}

export function identityAttachmentFileName(doc: LetterIdentityDoc, used: Set<string>): string {
  return uniqueZipFilename(stemForIdentityDoc(doc), extensionForIdentityDoc(doc), used)
}

export function namedLetterIdentityAttachments(
  docs: LetterIdentityDoc[]
): { doc: LetterIdentityDoc; zipName: string; mimeType: string }[] {
  const used = new Set<string>()
  return selectedLetterIdentityDocuments(docs).map((doc) => ({
    doc,
    zipName: identityAttachmentFileName(doc, used),
    mimeType: mimeForIdentityDoc(doc),
  }))
}

export function buildLetterZipFiles(letters: { title: string; data: Uint8Array }[]): { name: string; data: Uint8Array }[] {
  const used = new Set<string>()
  return letters.map((letter) => ({
    name: uniqueDocxFilename(letter.title || 'letter', used),
    data: letter.data,
  }))
}

export async function loadLetterIdentityAttachments(
  applicationUuid: string | null | undefined
): Promise<LetterPacketAttachment[]> {
  if (!applicationUuid) return []

  try {
    const docs = await getDocumentsByApplicationUuid(applicationUuid)
    const named = namedLetterIdentityAttachments(docs)
    const downloaded = await mapWithConcurrency(named, 4, async ({ doc, zipName, mimeType }) => {
      const result = await downloadCreditFundingDocument(doc.storage_path)
      if (!result.ok) {
        console.error('Letter identity attachment skipped:', doc.id, result.error)
        return null as LetterPacketAttachment | null
      }
      const file: LetterPacketAttachment = { zipName, data: result.data, mimeType }
      return file
    })
    return downloaded.filter((row): row is LetterPacketAttachment => row !== null)
  } catch (err) {
    console.error('Letter identity attachments failed:', err)
    return []
  }
}

async function fetchEnclosedLetterDocx(
  sessionId: string,
  letterId: string,
  attachments: LetterPacketAttachment[]
): Promise<Uint8Array> {
  const form = new FormData()
  for (const attachment of attachments) {
    const blob = new Blob([Buffer.from(attachment.data)], {
      type: attachment.mimeType || 'application/octet-stream',
    })
    form.append('enclosures', blob, attachment.zipName)
  }
  const posted = await disputeLettersFetchForm(
    `/internal/letters/${sessionId}/${letterId}/download?format=docx`,
    form
  )
  if (!posted.ok) {
    throw new Error(`Enclosure merge failed (HTTP ${posted.status})`)
  }
  const data = new Uint8Array(await posted.arrayBuffer())
  if (!isDocxBytes(data)) {
    throw new Error('Enclosure merge returned a non-DOCX payload')
  }
  return data
}

async function fetchPlainLetterDocx(sessionId: string, letterId: string): Promise<Uint8Array> {
  const res = await disputeLettersFetch(
    `/internal/letters/${sessionId}/${letterId}/download?format=docx`
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'DOCX download failed')
  }
  const data = new Uint8Array(await res.arrayBuffer())
  if (!isDocxBytes(data)) {
    throw new Error('Letter download was not a Word document. Redeploy the dispute-letters API.')
  }
  return data
}

/**
 * Download letter DOCX, optionally merging identity enclosures via the Python API.
 * Retries transient upstream failures; falls back to plain DOCX if enclosure merge fails.
 */
export async function fetchLetterDocxWithEnclosures(
  sessionId: string,
  letterId: string,
  attachments: LetterPacketAttachment[]
): Promise<Uint8Array> {
  if (attachments.length) {
    try {
      return await withRetries(
        () => fetchEnclosedLetterDocx(sessionId, letterId, attachments),
        3,
        400
      )
    } catch (error) {
      console.warn(
        '[letter-identity] enclosure merge failed after retries; falling back to plain DOCX',
        letterId,
        error instanceof Error ? error.message : error
      )
    }
  }

  return withRetries(() => fetchPlainLetterDocx(sessionId, letterId), 3, 400)
}

/** Build DOCX letter files for a ZIP in parallel (bounded concurrency). */
export async function fetchLetterDocxFilesForZip(
  sessionId: string,
  letters: { id: string; title?: string }[],
  attachments: LetterPacketAttachment[]
): Promise<{ title: string; data: Uint8Array }[]> {
  return mapWithConcurrency(letters, LETTER_DOCX_FETCH_CONCURRENCY, async (letter) => {
    try {
      const data = await fetchLetterDocxWithEnclosures(sessionId, letter.id, attachments)
      return {
        title: letter.title || letter.id,
        data,
      }
    } catch (error) {
      const label = letter.title || letter.id
      const detail = error instanceof Error ? error.message : 'download failed'
      throw new Error(`Letter "${label}" failed to download: ${detail}`)
    }
  })
}
