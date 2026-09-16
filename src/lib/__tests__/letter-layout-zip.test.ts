import assert from 'node:assert/strict'
import { inflateRawSync } from 'node:zlib'
import { describe, it } from 'node:test'
import { letterLayout } from '../dispute-letters/letter-layout'
import { isDocxBytes, uniqueDocxFilename, zipFiles } from '../dispute-letters/letter-zip'

const SAMPLE = `September 12, 2026

JANE CONSUMER
123 MAIN STREET
ANYTOWN, NJ 08000

KIKOFF LENDING LLC

Re: Formal Dispute

Dear Sir or Madam:

Consumer Identification
Full Name: Jane Consumer

Disputed Tradelines
● Kikoff Lending LLC — Account Number: ****1234
`

describe('letterLayout', () => {
  it('treats Enclosures as a section heading', () => {
    const layout = letterLayout(`${SAMPLE}
Respectfully,


Jane Consumer

Enclosures
● Copy of government-issued photo identification
● Proof of current residential address
`)
    assert.equal(
      layout.blocks.some((block) => block.kind === 'line' && block.variant === 'heading' && block.text === 'Enclosures'),
      true
    )
    assert.equal(
      layout.blocks.some((block) => block.kind === 'line' && block.variant === 'closing' && block.text === 'Respectfully,'),
      true
    )
    assert.equal(
      layout.blocks.filter((block) => block.kind === 'bullet').length >= 2,
      true
    )
  })

  it('puts the date in the header and not the body', () => {
    const layout = letterLayout(SAMPLE)
    assert.equal(layout.date, 'September 12, 2026')
    const body = layout.blocks
      .map((block) => (block.kind === 'line' || block.kind === 'bullet' ? block.text : ''))
      .join('\n')
    assert.equal(body.includes('September 12, 2026'), false)
    assert.equal(
      layout.blocks.some((block) => block.kind === 'line' && block.variant === 'name' && block.text === 'JANE CONSUMER'),
      true
    )
    assert.equal(
      layout.blocks.some(
        (block) => block.kind === 'line' && block.variant === 'field' && block.text.startsWith('Full Name:')
      ),
      true
    )
  })
})

describe('letter zip packaging', () => {
  it('names files uniquely as .docx', () => {
    const used = new Set<string>()
    assert.equal(uniqueDocxFilename('Experian — 4 item(s)', used), 'Experian — 4 item(s).docx')
    assert.equal(uniqueDocxFilename('Experian — 4 item(s)', used), 'Experian — 4 item(s) (2).docx')
  })

  it('zips payloads that inflate back to the original bytes', () => {
    const payload = Buffer.from('PK\x03\x04fake-docx-body')
    const zip = zipFiles([
      { name: 'Experian — 4 item(s).docx', data: payload },
      { name: 'Kikoff.docx', data: payload },
    ])
    assert.equal(isDocxBytes(payload), true)
    assert.equal(zip.subarray(0, 2).toString(), 'PK')
    assert.match(zip.toString('binary'), /Kikoff\.docx/)
    assert.equal(zip.includes(Buffer.from('.txt')), false)

    const name = Buffer.from('Experian — 4 item(s).docx')
    const nameStart = zip.indexOf(name)
    const headerStart = nameStart - 30
    const compSize = zip.readUInt32LE(headerStart + 18)
    const compressed = zip.subarray(nameStart + name.length, nameStart + name.length + compSize)
    assert.equal(inflateRawSync(compressed).equals(payload), true)
  })
})
