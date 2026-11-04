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

function docxBytes(marker: number): Uint8Array {
  return new Uint8Array([0x50, 0x4b, 0x03, 0x04, marker])
}

describe('stored letter docx paths', () => {
  it('accepts only a docx object stored for this session', () => {
    const path = buildStoredLetterDocxPath(SESSION, 'letter-1')
    assert.equal(isStoredLetterDocxPath(SESSION, path), true)
    assert.equal(isStoredLetterDocxPath(SESSION, `${path}.txt`), false)
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
        return docxBytes(readPaths.length)
      },
      generateMissing: async (letter) => {
        generateCalls += 1
        assert.ok(letter.id === 'letter-c' || letter.id === 'letter-d')
        return docxBytes(9)
      },
    })

    assert.equal(generateCalls, 2)
    assert.deepEqual(readPaths.sort(), [storedA, storedB, storedC, storedD].sort())
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
    assert.ok(zipped.every((file) => file.name.endsWith('.docx')))
    assert.equal(
      zipped.some((file) => file.name.toLowerCase().endsWith('.txt')),
      false
    )
    const archive = zipFiles(zipped)
    assert.equal(archive.includes(Buffer.from('.txt')), false)
    assert.equal(archive.includes(Buffer.from('Experian — 4 item(s).docx')), true)
    assert.equal(archive.includes(Buffer.from('Kikoff — 1 item(s).docx')), true)
    const name = Buffer.from('Equifax — 2 item(s).docx')
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
      readStored: async () => docxBytes(1),
      generateMissing: async () => {
        generateCalls += 1
        return docxBytes(2)
      },
    })
    assert.equal(generateCalls, 0)
    assert.equal(files.length, 2)
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
