import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  formatAddressForLetter,
  formatDobForLetter,
  formatSsnForLetter,
  resolveLetterConsumerFields,
} from '../dispute-letters/letter-consumer-identity'

describe('letter consumer identity', () => {
  it('formats full SSN as XXX-XX-XXXX', () => {
    assert.equal(formatSsnForLetter('123456789'), '123-45-6789')
    assert.equal(formatSsnForLetter('123-45-6789'), '123-45-6789')
  })

  it('formats ISO DOB for mailed letters', () => {
    assert.equal(formatDobForLetter('1988-01-15'), 'January 15, 1988')
    assert.equal(formatDobForLetter('January 15, 1988'), 'January 15, 1988')
  })

  it('formats intake mailing address on one line', () => {
    assert.equal(
      formatAddressForLetter({
        address: '4 Meadow Cir',
        city: 'Mays Landing',
        state: 'NJ',
        zip_code: '08330',
      }),
      '4 Meadow Cir, Mays Landing, NJ 08330'
    )
  })

  it('falls back to intake name and address when Confirm fields are blank', () => {
    const resolved = resolveLetterConsumerFields(
      { consumer_name: '', consumer_addresses: [] },
      {
        name: 'Nasir Mahmoud',
        addresses: ['4 Meadow Cir, Mays Landing, NJ 08330'],
        ssn: '138-17-0301',
        dob: 'January 3, 2006',
      }
    )
    assert.equal(resolved.consumer_name, 'Nasir Mahmoud')
    assert.deepEqual(resolved.consumer_addresses, ['4 Meadow Cir, Mays Landing, NJ 08330'])
    assert.equal(resolved.consumer_ssn, '138-17-0301')
    assert.equal(resolved.consumer_dob, 'January 3, 2006')
  })

  it('prefers Confirm-step overrides over intake', () => {
    const resolved = resolveLetterConsumerFields(
      {
        consumer_name: 'NASIR M.',
        consumer_addresses: ['PO Box 1, Atlantic City, NJ 08401'],
      },
      {
        name: 'Nasir Mahmoud',
        addresses: ['4 Meadow Cir, Mays Landing, NJ 08330'],
        ssn: '138-17-0301',
        dob: 'January 3, 2006',
      }
    )
    assert.equal(resolved.consumer_name, 'NASIR M.')
    assert.deepEqual(resolved.consumer_addresses, ['PO Box 1, Atlantic City, NJ 08401'])
  })

  it('generate routes load intake identity and resolve name/address/ssn/dob', () => {
    const root = path.join(process.cwd(), 'src/app/api/admin/dispute-letters/[id]/generate')
    const postRoute = readFileSync(path.join(root, 'route.ts'), 'utf8')
    const streamRoute = readFileSync(path.join(root, 'stream/route.ts'), 'utf8')
    for (const source of [postRoute, streamRoute]) {
      assert.match(source, /loadLetterConsumerIdentity/)
      assert.match(source, /resolveLetterConsumerFields/)
      assert.match(source, /consumer_ssn:\s*consumer\.consumer_ssn/)
      assert.match(source, /consumer_dob:\s*consumer\.consumer_dob/)
      assert.match(source, /consumer_name:\s*consumer\.consumer_name/)
      assert.match(source, /consumer_addresses:\s*consumer\.consumer_addresses/)
      assert.doesNotMatch(source, /body\.consumer_ssn/)
    }
  })
})
