import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { formatDobForLetter, formatSsnForLetter } from '../dispute-letters/letter-consumer-identity'

describe('letter consumer identity', () => {
  it('formats full SSN as XXX-XX-XXXX', () => {
    assert.equal(formatSsnForLetter('123456789'), '123-45-6789')
    assert.equal(formatSsnForLetter('123-45-6789'), '123-45-6789')
  })

  it('formats ISO DOB for mailed letters', () => {
    assert.equal(formatDobForLetter('1988-01-15'), 'January 15, 1988')
    assert.equal(formatDobForLetter('January 15, 1988'), 'January 15, 1988')
  })

  it('generate routes load identity server-side and pass consumer_ssn', () => {
    const root = path.join(process.cwd(), 'src/app/api/admin/dispute-letters/[id]/generate')
    const postRoute = readFileSync(path.join(root, 'route.ts'), 'utf8')
    const streamRoute = readFileSync(path.join(root, 'stream/route.ts'), 'utf8')
    for (const source of [postRoute, streamRoute]) {
      assert.match(source, /loadLetterConsumerIdentity/)
      assert.match(source, /consumer_ssn:\s*identity\.ssn/)
      assert.match(source, /consumer_dob:\s*identity\.dob/)
      assert.doesNotMatch(source, /body\.consumer_ssn/)
    }
  })
})
