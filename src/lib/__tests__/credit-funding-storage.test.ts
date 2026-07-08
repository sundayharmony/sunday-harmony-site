import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { scanFileBuffer, validateCreditFundingFile } from '../credit-funding-storage'

describe('validateCreditFundingFile', () => {
  it('accepts PDF under size limit', () => {
    const r = validateCreditFundingFile('application/pdf', 1024, 'report.pdf')
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.mime, 'application/pdf')
  })

  it('accepts TXT by extension', () => {
    const r = validateCreditFundingFile('application/octet-stream', 500, 'notes.txt')
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.mime, 'text/plain')
  })

  it('accepts TXT with text/plain mime', () => {
    const r = validateCreditFundingFile('text/plain', 500, 'notes.txt')
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.mime, 'text/plain')
  })

  it('rejects unsupported extensions', () => {
    const r = validateCreditFundingFile('application/octet-stream', 100, 'file.exe')
    assert.equal(r.ok, false)
  })

  it('rejects oversize files', () => {
    const r = validateCreditFundingFile('text/plain', 5 * 1024 * 1024, 'big.txt')
    assert.equal(r.ok, false)
    if (!r.ok) assert.match(r.error, /too large/i)
  })
})

describe('scanFileBuffer', () => {
  it('accepts plain text content', () => {
    const r = scanFileBuffer(Buffer.from('Hello, this is a text document.\n'), 'text/plain')
    assert.equal(r.ok, true)
  })

  it('rejects PDF magic mismatch', () => {
    const r = scanFileBuffer(Buffer.from('not a pdf file'), 'application/pdf')
    assert.equal(r.ok, false)
  })
})
