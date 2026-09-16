import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildLetterPacketZipFiles,
  identityAttachmentZipName,
  namedLetterIdentityAttachments,
  pickLetterIdentityDocuments,
  selectedLetterIdentityDocuments,
  type LetterIdentityDoc,
} from '../dispute-letters/letter-identity-attachments'

function doc(partial: Partial<LetterIdentityDoc> & Pick<LetterIdentityDoc, 'id' | 'document_type'>): LetterIdentityDoc {
  return {
    storage_path: `${partial.document_type}/${partial.id}.pdf`,
    file_name: `${partial.id}.pdf`,
    mime_type: 'application/pdf',
    scan_status: 'clean',
    ...partial,
  }
}

describe('letter identity attachments', () => {
  it('attaches every photo ID and prefers proof_of_address over mail_proof', () => {
    const picked = pickLetterIdentityDocuments([
      doc({ id: 'id-front', document_type: 'photo_id', file_name: 'front.jpg', mime_type: 'image/jpeg' }),
      doc({ id: 'id-back', document_type: 'photo_id', file_name: 'back.jpg', mime_type: 'image/jpeg' }),
      doc({ id: 'mail', document_type: 'mail_proof' }),
      doc({ id: 'address', document_type: 'proof_of_address' }),
      doc({ id: 'selfie', document_type: 'selfie_with_id' }),
    ])
    assert.deepEqual(
      picked.photoIds.map((row) => row.id),
      ['id-front', 'id-back']
    )
    assert.equal(picked.proofOfAddress?.id, 'address')
  })

  it('falls back to mail proof when no dedicated proof of address exists', () => {
    const picked = pickLetterIdentityDocuments([
      doc({ id: 'id-1', document_type: 'photo_id' }),
      doc({ id: 'mail', document_type: 'mail_proof' }),
    ])
    assert.equal(picked.proofOfAddress?.id, 'mail')
  })

  it('skips rejected scans and still returns usable identity files', () => {
    const selected = selectedLetterIdentityDocuments([
      doc({ id: 'bad-id', document_type: 'photo_id', scan_status: 'rejected' }),
      doc({ id: 'good-id', document_type: 'photo_id' }),
      doc({ id: 'bad-mail', document_type: 'mail_proof', scan_status: 'rejected' }),
    ])
    assert.deepEqual(
      selected.map((row) => row.id),
      ['good-id']
    )
  })

  it('names mailing copies Government Photo ID and Proof of Address', () => {
    const used = new Set<string>()
    assert.equal(
      identityAttachmentZipName(doc({ id: 'id-1', document_type: 'photo_id', file_name: 'dl.png' }), used),
      'Government Photo ID.png'
    )
    assert.equal(
      identityAttachmentZipName(doc({ id: 'id-2', document_type: 'photo_id', file_name: 'dl-back.png' }), used),
      'Government Photo ID (2).png'
    )
    assert.equal(
      identityAttachmentZipName(doc({ id: 'mail', document_type: 'mail_proof', file_name: 'bill.pdf' }), used),
      'Proof of Address.pdf'
    )
  })

  it('copies ID and address into every letter folder', () => {
    const named = namedLetterIdentityAttachments([
      doc({ id: 'id-1', document_type: 'photo_id', file_name: 'id.jpg', mime_type: 'image/jpeg' }),
      doc({ id: 'addr', document_type: 'proof_of_address', file_name: 'lease.pdf' }),
    ])
    const attachments = named.map((row) => ({ zipName: row.zipName, data: new Uint8Array([1, 2, 3]) }))
    const payload = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    const files = buildLetterPacketZipFiles({
      letters: [
        { title: 'Experian — 4 item(s)', data: payload },
        { title: 'Equifax — 2 item(s)', data: payload },
      ],
      attachments,
    })
    assert.deepEqual(
      files.map((file) => file.name),
      [
        'Experian — 4 item(s)/Experian — 4 item(s).docx',
        'Experian — 4 item(s)/Government Photo ID.jpg',
        'Experian — 4 item(s)/Proof of Address.pdf',
        'Equifax — 2 item(s)/Equifax — 2 item(s).docx',
        'Equifax — 2 item(s)/Government Photo ID.jpg',
        'Equifax — 2 item(s)/Proof of Address.pdf',
      ]
    )
  })

  it('still packages letters when identity documents are missing', () => {
    const payload = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    const files = buildLetterPacketZipFiles({
      letters: [{ title: 'Experian — 1 item(s)', data: payload }],
      attachments: [],
    })
    assert.deepEqual(
      files.map((file) => file.name),
      ['Experian — 1 item(s)/Experian — 1 item(s).docx']
    )
  })
})
