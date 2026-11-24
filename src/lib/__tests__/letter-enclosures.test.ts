import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildStoredLetterDocxPath, isStoredLetterDocxPath } from '../dispute-letters/letter-docx-cache'
import { letterIdentitySignature } from '../dispute-letters/letter-identity-attachments'
import { withActualEnclosures } from '../dispute-letters/letter-pdf-render'

const SESSION = '11111111-2222-3333-4444-555555555555'
const LETTER = `Respectfully,

Jane Doe

Enclosures
● Copy of government-issued photo identification
● Photo of mail showing your name and current address
`

describe('letter enclosures', () => {
  it('lists exactly the documents attached', () => {
    const out = withActualEnclosures(LETTER, [
      'Government Photo ID.jpg',
      'Photo of Mail.jpg',
      'Social Security Card.png',
    ])
    assert.match(out, /Enclosures\n● Copy of government-issued photo identification\n● Photo of mail showing my name and current address\n● Copy of Social Security card/)
    assert.doesNotMatch(out, /your name/)
  })

  it('drops the section when nothing is attached', () => {
    const out = withActualEnclosures(LETTER, [])
    assert.doesNotMatch(out, /Enclosures|photo identification/)
    assert.match(out, /Jane Doe\n$/)
  })

  it('names only what is there', () => {
    const out = withActualEnclosures(LETTER, ['Government Photo ID.jpg'])
    assert.doesNotMatch(out, /Photo of mail/)
  })

  it('serves a stored PDF only while the ID documents are unchanged', () => {
    const docs = [
      { id: 'a', document_type: 'photo_id', storage_path: 'apps/x/id-v1.jpg', file_name: 'id.jpg' },
    ]
    const before = letterIdentitySignature(docs)
    const after = letterIdentitySignature([{ ...docs[0], storage_path: 'apps/x/id-v2.jpg' }])
    assert.match(before, /^[a-f0-9]{8}$/)
    assert.notEqual(before, after)

    const path = buildStoredLetterDocxPath(SESSION, 'letter-1', before)
    assert.equal(isStoredLetterDocxPath(SESSION, path, before), true)
    assert.equal(isStoredLetterDocxPath(SESSION, path, after), false)
    // Old v3 PDFs listed enclosures that may not be attached: rebuild them.
    assert.equal(isStoredLetterDocxPath(SESSION, `sessions/${SESSION}/letters/letter-1.v3.pdf`), false)
  })
})
