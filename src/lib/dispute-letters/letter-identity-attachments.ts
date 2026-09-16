import { getDocumentsByApplicationUuid } from '@/lib/credit-funding-db'
import { downloadCreditFundingDocument } from '@/lib/credit-funding-storage'
import { uniqueDocxFilename, uniqueZipFilename, uniqueZipFolderName } from '@/lib/dispute-letters/letter-zip'

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
}

const PHOTO_ID_STEM = 'Government Photo ID'
const ADDRESS_STEM = 'Proof of Address'

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

function stemForIdentityDoc(doc: LetterIdentityDoc): string {
  if (doc.document_type === 'photo_id') return PHOTO_ID_STEM
  if (doc.document_type === 'proof_of_address' || doc.document_type === 'mail_proof') return ADDRESS_STEM
  return 'Identity Document'
}

export function identityAttachmentZipName(doc: LetterIdentityDoc, used: Set<string>): string {
  return uniqueZipFilename(stemForIdentityDoc(doc), extensionForIdentityDoc(doc), used)
}

export function namedLetterIdentityAttachments(docs: LetterIdentityDoc[]): { doc: LetterIdentityDoc; zipName: string }[] {
  const used = new Set<string>()
  return selectedLetterIdentityDocuments(docs).map((doc) => ({
    doc,
    zipName: identityAttachmentZipName(doc, used),
  }))
}

export function buildLetterPacketZipFiles(params: {
  letters: { title: string; data: Uint8Array }[]
  attachments: LetterPacketAttachment[]
}): { name: string; data: Uint8Array }[] {
  const usedFolders = new Set<string>()
  const files: { name: string; data: Uint8Array }[] = []

  for (const letter of params.letters) {
    const folder = uniqueZipFolderName(letter.title || 'letter', usedFolders)
    const usedInFolder = new Set<string>()
    const docxName = uniqueDocxFilename(letter.title || 'letter', usedInFolder)
    files.push({ name: `${folder}/${docxName}`, data: letter.data })
    for (const attachment of params.attachments) {
      files.push({ name: `${folder}/${attachment.zipName}`, data: attachment.data })
    }
  }

  return files
}

export async function loadLetterIdentityAttachments(
  applicationUuid: string | null | undefined
): Promise<LetterPacketAttachment[]> {
  if (!applicationUuid) return []

  try {
    const docs = await getDocumentsByApplicationUuid(applicationUuid)
    const named = namedLetterIdentityAttachments(docs)
    const files: LetterPacketAttachment[] = []

    for (const { doc, zipName } of named) {
      const downloaded = await downloadCreditFundingDocument(doc.storage_path)
      if (!downloaded.ok) {
        console.error('Letter identity attachment skipped:', doc.id, downloaded.error)
        continue
      }
      files.push({ zipName, data: downloaded.data })
    }

    return files
  } catch (err) {
    console.error('Letter identity attachments failed:', err)
    return []
  }
}
