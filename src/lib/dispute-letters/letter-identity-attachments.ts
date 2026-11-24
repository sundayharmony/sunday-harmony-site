import { createHash } from 'node:crypto'
import { getDocumentsByApplicationUuid } from '@/lib/credit-funding-db'
import {
  isLetterWorkingCopyPath,
  letterWorkingCopyOriginalId,
} from '@/lib/credit-funding-types'
import { downloadCreditFundingDocument } from '@/lib/credit-funding-storage'
import { mapWithConcurrency } from '@/lib/dispute-letters/async-pool'
import { uniquePdfFilename, uniqueZipFilename } from '@/lib/dispute-letters/letter-zip'

export type LetterIdentityDoc = {
  id: string
  document_type: string
  storage_path: string
  file_name: string
  mime_type?: string | null
  scan_status?: string | null
  created_at?: string | null
}

export type LetterIdentityPicks = {
  photoIds: LetterIdentityDoc[]
  mailPhoto: LetterIdentityDoc | null
  ssnCard: LetterIdentityDoc | null
}

export type LetterIdentityRequirementKey = 'photo_id' | 'proof_of_residence' | 'ssn_card'

export type LetterIdentityRequirement = {
  key: LetterIdentityRequirementKey
  label: string
  types: readonly string[]
  uploadType: string
  defaultRequestNote: string
}

export const LETTER_IDENTITY_REQUIREMENTS: readonly LetterIdentityRequirement[] = [
  {
    key: 'photo_id',
    label: 'Government Photo ID',
    types: ['photo_id'],
    uploadType: 'photo_id',
    defaultRequestNote:
      'Please send a clear photo of the front of your government-issued ID (driver’s license, state ID, or passport). Crop out the background if you can.',
  },
  {
    key: 'proof_of_residence',
    label: 'Photo of mail',
    types: ['mail_proof'],
    uploadType: 'mail_proof',
    defaultRequestNote:
      'Please send a photo of a piece of mail that shows your name and current address.',
  },
  {
    key: 'ssn_card',
    label: 'Social Security Card',
    types: ['ssn_card'],
    uploadType: 'ssn_card',
    defaultRequestNote: 'Please send a clear photo of the front of your Social Security card.',
  },
]

export type LetterPacketAttachment = {
  zipName: string
  data: Uint8Array
  mimeType?: string
}

const PHOTO_ID_STEM = 'Government Photo ID'
const ADDRESS_STEM = 'Photo of Mail'
const SSN_STEM = 'Social Security Card'

function isUsableIdentityDoc(doc: LetterIdentityDoc): boolean {
  return doc.scan_status !== 'rejected' && Boolean(doc.storage_path)
}

function latestCreated(docs: LetterIdentityDoc[]): LetterIdentityDoc | undefined {
  return [...docs].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0]
}

function resolveLetterIdentityDocs(usable: LetterIdentityDoc[], documentType: string): LetterIdentityDoc[] {
  const ofType = usable.filter((doc) => doc.document_type === documentType)
  const originals = ofType.filter((doc) => !isLetterWorkingCopyPath(doc.storage_path))
  const copies = ofType.filter((doc) => isLetterWorkingCopyPath(doc.storage_path))
  const resolved: LetterIdentityDoc[] = []
  const usedCopyIds = new Set<string>()

  for (const original of originals) {
    const copy = latestCreated(
      copies.filter((doc) => letterWorkingCopyOriginalId(doc.storage_path) === original.id.toLowerCase())
    )
    if (copy) {
      resolved.push(copy)
      usedCopyIds.add(copy.id)
    } else {
      resolved.push(original)
    }
  }

  for (const copy of copies) {
    if (usedCopyIds.has(copy.id)) continue
    const originalId = letterWorkingCopyOriginalId(copy.storage_path)
    if (originalId && originals.some((doc) => doc.id.toLowerCase() === originalId)) continue
    resolved.push(copy)
  }

  return resolved
}

export function pickLetterIdentityDocuments(docs: LetterIdentityDoc[]): LetterIdentityPicks {
  const usable = docs.filter(isUsableIdentityDoc)
  const photoIds = resolveLetterIdentityDocs(usable, 'photo_id')
  const mailPhoto = resolveLetterIdentityDocs(usable, 'mail_proof')[0] || null
  const ssnCard = resolveLetterIdentityDocs(usable, 'ssn_card')[0] || null
  return { photoIds, mailPhoto, ssnCard }
}

export function selectedLetterIdentityDocuments(docs: LetterIdentityDoc[]): LetterIdentityDoc[] {
  const picked = pickLetterIdentityDocuments(docs)
  return [
    ...picked.photoIds,
    ...(picked.mailPhoto ? [picked.mailPhoto] : []),
    ...(picked.ssnCard ? [picked.ssnCard] : []),
  ]
}

export function letterDocsForRequirement(
  docs: LetterIdentityDoc[],
  requirement: LetterIdentityRequirement
): LetterIdentityDoc[] {
  const usable = docs.filter(isUsableIdentityDoc)
  const resolved = resolveLetterIdentityDocs(usable, requirement.uploadType)
  if (requirement.key === 'proof_of_residence') return resolved.slice(0, 1)
  return resolved
}

export function missingLetterIdentityRequirements(docs: LetterIdentityDoc[]): LetterIdentityRequirement[] {
  return LETTER_IDENTITY_REQUIREMENTS.filter((requirement) => letterDocsForRequirement(docs, requirement).length === 0)
}

export async function findMissingLetterIdentityForApplication(
  applicationUuid?: string | null
): Promise<LetterIdentityRequirement[]> {
  if (!applicationUuid) return []
  const docs = await getDocumentsByApplicationUuid(applicationUuid)
  return missingLetterIdentityRequirements(docs)
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
  if (doc.document_type === 'mail_proof') return ADDRESS_STEM
  if (doc.document_type === 'ssn_card') return SSN_STEM
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
    name: uniquePdfFilename(letter.title || 'letter', used),
    data: letter.data,
  }))
}

/** Short fingerprint of the ID documents a letter would carry (ids + stored files). */
export function letterIdentitySignature(docs: LetterIdentityDoc[]): string {
  const key = selectedLetterIdentityDocuments(docs)
    .map((doc) => `${doc.id}:${doc.storage_path}`)
    .join('|')
  if (!key) return ''
  return createHash('sha1').update(key).digest('hex').slice(0, 8)
}

export async function letterIdentitySignatureForApplication(
  applicationUuid: string | null | undefined
): Promise<string> {
  if (!applicationUuid) return ''
  return letterIdentitySignature(await getDocumentsByApplicationUuid(applicationUuid))
}

const EMBEDDABLE_MIME = /^(application\/pdf|image\/(png|jpe?g))$/

/**
 * ID documents for a letter PDF, plus their fingerprint. Throws instead of returning a short
 * list: a letter must never be saved (and cached) without the documents it says are enclosed.
 */
export async function loadLetterIdentityAttachments(
  applicationUuid: string | null | undefined
): Promise<{ files: LetterPacketAttachment[]; signature: string }> {
  if (!applicationUuid) return { files: [], signature: '' }

  const docs = await getDocumentsByApplicationUuid(applicationUuid)
  const named = namedLetterIdentityAttachments(docs)
  for (const { doc, mimeType } of named) {
    if (!EMBEDDABLE_MIME.test(mimeType) && !/\.(pdf|png|jpe?g)$/i.test(doc.file_name)) {
      throw new Error(
        `${stemForIdentityDoc(doc)} is a ${mimeType || 'file type'} the letter PDF can't include. ` +
          'Open "Crop for letters" on it and save, which makes a JPEG.'
      )
    }
  }
  const files = await mapWithConcurrency(named, 4, async ({ doc, zipName, mimeType }) => {
    const result = await downloadCreditFundingDocument(doc.storage_path)
    if (!result.ok) {
      throw new Error(`Could not load the ${stemForIdentityDoc(doc)} for the letters. Try again.`)
    }
    const file: LetterPacketAttachment = { zipName, data: result.data, mimeType }
    return file
  })
  return { files, signature: letterIdentitySignature(docs) }
}
