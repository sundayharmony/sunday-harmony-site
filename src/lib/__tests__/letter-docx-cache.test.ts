import assert from 'node:assert/strict'
import { inflateRawSync } from 'node:zlib'
import { describe, it } from 'node:test'
import {
  assembleLetterDocxFiles,
  buildStoredLetterDocxPath,
  isStoredLetterDocxPath,
  isZipBuildInFlight,
  ZIP_BUILD_JOIN_MS,
} from '../dispute-letters/letter-docx-cache'
import { buildLetterZipFiles } from '../dispute-letters/letter-identity-attachments'
import { zipFiles } from '../dispute-letters/letter-zip'

const SESSION = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

function pdfBytes(marker: number): Uint8Array {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, marker])
}

describe('stored letter pdf paths', () => {
  it('accepts only a pdf object stored for this session', () => {
    const path = buildStoredLetterDocxPath(SESSION, 'letter-1')
    assert.match(path, /\.pdf$/)
    assert.equal(isStoredLetterDocxPath(SESSION, path), true)
    assert.equal(isStoredLetterDocxPath(SESSION, `${path}.txt`), false)
    assert.equal(isStoredLetterDocxPath(SESSION, `sessions/${SESSION}/letters/letter-1.docx`), false)
    assert.equal(isStoredLetterDocxPath(SESSION, `sessions/${SESSION}/letters/letter-1.txt`), false)
    assert.equal(isStoredLetterDocxPath(SESSION, '/tmp/letters/session/plan.letter'), false)
    assert.equal(isStoredLetterDocxPath('other-session', path), false)
  })
})

describe('assembleLetterDocxFiles', () => {
  it('zips an already-stored letter without regenerating and bounds concurrent reads', async () => {
    const storedA = buildStoredLetterDocxPath(SESSION, 'letter-a')
    const storedB = buildStoredLetterDocxPath(SESSION, 'letter-b')
    let generateCalls = 0
    let inFlight = 0
    let maxInFlight = 0
    const readPaths: string[] = []

    const storedC = buildStoredLetterDocxPath(SESSION, 'letter-e')
    const storedD = buildStoredLetterDocxPath(SESSION, 'letter-f')
    const canonicalC = buildStoredLetterDocxPath(SESSION, 'letter-c')
    const canonicalD = buildStoredLetterDocxPath(SESSION, 'letter-d')
    const present = new Set([storedA, storedB, storedC, storedD])
    const files = await assembleLetterDocxFiles({
      sessionId: SESSION,
      concurrency: 2,
      letters: [
        { id: 'letter-a', title: 'Experian — 4 item(s)', storage_path: storedA },
        { id: 'letter-b', title: 'Equifax — 2 item(s)', storage_path: storedB },
        { id: 'letter-e', title: 'Experian furnisher', storage_path: storedC },
        { id: 'letter-f', title: 'Equifax furnisher', storage_path: storedD },
        { id: 'letter-c', title: 'TransUnion — 1 item(s)', storage_path: '/tmp/letters/tu.letter' },
        { id: 'letter-d', title: 'Kikoff — 1 item(s)', storage_path: `sessions/${SESSION}/letters/old.txt` },
      ],
      readStored: async (storagePath) => {
        readPaths.push(storagePath)
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 30))
        inFlight -= 1
        return present.has(storagePath) ? pdfBytes(readPaths.length) : null
      },
      generateMissing: async (letter) => {
        generateCalls += 1
        assert.ok(letter.id === 'letter-c' || letter.id === 'letter-d')
        return pdfBytes(9)
      },
    })

    assert.equal(generateCalls, 2)
    assert.deepEqual(readPaths.sort(), [storedA, storedB, storedC, storedD, canonicalC, canonicalD].sort())
    assert.ok(maxInFlight <= 2)
    assert.ok(maxInFlight >= 2)
    assert.equal(files.length, 6)
    assert.deepEqual(
      files.map((file) => file.title),
      [
        'Experian — 4 item(s)',
        'Equifax — 2 item(s)',
        'Experian furnisher',
        'Equifax furnisher',
        'TransUnion — 1 item(s)',
        'Kikoff — 1 item(s)',
      ]
    )

    const zipped = buildLetterZipFiles(files)
    assert.ok(zipped.every((file) => file.name.endsWith('.pdf')))
    assert.equal(
      zipped.some((file) => file.name.toLowerCase().endsWith('.txt')),
      false
    )
    const archive = zipFiles(zipped)
    assert.equal(archive.includes(Buffer.from('.txt')), false)
    assert.equal(archive.includes(Buffer.from('Experian — 4 item(s).pdf')), true)
    assert.equal(archive.includes(Buffer.from('Kikoff — 1 item(s).pdf')), true)
    const name = Buffer.from('Equifax — 2 item(s).pdf')
    const nameStart = archive.indexOf(name)
    assert.ok(nameStart > 30)
    const headerStart = nameStart - 30
    const compSize = archive.readUInt32LE(headerStart + 18)
    const compressed = archive.subarray(nameStart + name.length, nameStart + name.length + compSize)
    assert.equal(inflateRawSync(compressed).equals(Buffer.from(files[1].data)), true)
  })

  it('does not call the generator when every letter is already stored', async () => {
    let generateCalls = 0
    const files = await assembleLetterDocxFiles({
      sessionId: SESSION,
      concurrency: 2,
      letters: [
        { id: 'letter-a', title: 'Experian', storage_path: buildStoredLetterDocxPath(SESSION, 'letter-a') },
        { id: 'letter-b', title: 'Equifax', storage_path: buildStoredLetterDocxPath(SESSION, 'letter-b') },
      ],
      readStored: async () => pdfBytes(1),
      generateMissing: async () => {
        generateCalls += 1
        return pdfBytes(2)
      },
    })
    assert.equal(generateCalls, 0)
    assert.equal(files.length, 2)
  })

  it('generates missing letter PDFs one at a time', async () => {
    let inFlight = 0
    let maxInFlight = 0
    let generateCalls = 0
    const files = await assembleLetterDocxFiles({
      sessionId: SESSION,
      letters: [
        { id: 'letter-a', title: 'Experian', storage_path: '/tmp/a.letter' },
        { id: 'letter-b', title: 'Equifax', storage_path: '/tmp/b.letter' },
        { id: 'letter-c', title: 'TransUnion', storage_path: '/tmp/c.letter' },
      ],
      readStored: async () => null,
      generateMissing: async () => {
        generateCalls += 1
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 20))
        inFlight -= 1
        return pdfBytes(generateCalls)
      },
    })
    assert.equal(generateCalls, 3)
    assert.equal(maxInFlight, 1)
    assert.equal(files.length, 3)
  })

  it('reuses a canonical stored PDF even when the DB path is still a local generator path', async () => {
    let generateCalls = 0
    const canonical = buildStoredLetterDocxPath(SESSION, 'letter-a')
    const files = await assembleLetterDocxFiles({
      sessionId: SESSION,
      letters: [{ id: 'letter-a', title: 'Experian', storage_path: '/tmp/letters/a.letter' }],
      readStored: async (storagePath) => (storagePath === canonical ? pdfBytes(1) : null),
      generateMissing: async () => {
        generateCalls += 1
        return pdfBytes(2)
      },
    })
    assert.equal(generateCalls, 0)
    assert.equal(files.length, 1)
    assert.equal(files[0].data[4], 1)
  })
})

describe('zip build in-flight claim', () => {
  it('does not treat a stale building row as a live build', () => {
    const now = Date.parse('2026-11-04T00:00:00.000Z')
    const stale = new Date(now - ZIP_BUILD_JOIN_MS - 1000).toISOString()
    assert.equal(
      isZipBuildInFlight(
        { zip_status: 'building', zip_letter_ids: 'a,b', updated_at: stale },
        ['b', 'a'],
        now
      ),
      false
    )
    assert.equal(
      isZipBuildInFlight(
        { zip_status: 'building', zip_letter_ids: 'a,b', updated_at: new Date(now).toISOString() },
        ['a', 'b'],
        now
      ),
      true
    )
  })
})
