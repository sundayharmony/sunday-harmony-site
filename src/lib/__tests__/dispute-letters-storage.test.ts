import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { disputeLetterRoundIndex, disputeLettersZipDownloadName, validateDisputeReportFile } from '../dispute-letters-storage'

describe('validateDisputeReportFile', () => {
  it('accepts PDF under size limit', () => {
    const r = validateDisputeReportFile('application/pdf', 1024, 'report.pdf')
    assert.equal(r.ok, true)
  })

  it('rejects oversize files', () => {
    const r = validateDisputeReportFile('application/pdf', 60 * 1024 * 1024, 'big.pdf')
    assert.equal(r.ok, false)
    if (!r.ok) assert.match(r.error, /too large/i)
  })

  it('rejects unsupported extensions', () => {
    const r = validateDisputeReportFile('application/octet-stream', 100, 'file.exe')
    assert.equal(r.ok, false)
  })

  it('accepts HTML by extension', () => {
    const r = validateDisputeReportFile('application/octet-stream', 500, 'report.html')
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.effectiveMime, 'text/html')
  })

  it('accepts TXT by extension', () => {
    const r = validateDisputeReportFile('application/octet-stream', 500, 'report.txt')
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.effectiveMime, 'text/plain')
  })

  it('rejects a declared type that conflicts with the file extension', () => {
    const r = validateDisputeReportFile('image/png', 500, 'report.txt')
    assert.equal(r.ok, false)
  })
})

describe('disputeLettersZipDownloadName', () => {
  it('uses consumer name with round suffix', () => {
    assert.equal(disputeLettersZipDownloadName('Jane Doe'), 'Jane Doe round 1 Letters.zip')
    assert.equal(disputeLettersZipDownloadName('Jane Doe', 3), 'Jane Doe round 3 Letters.zip')
  })

  it('falls back when name is missing', () => {
    assert.equal(disputeLettersZipDownloadName(''), 'Client round 1 Letters.zip')
  })

  it('names later sessions as round 2+', () => {
    assert.equal(disputeLettersZipDownloadName('Jane Doe', 2), 'Jane Doe round 2 Letters.zip')
    assert.equal(
      disputeLetterRoundIndex(
        [
          { id: 'new', created_at: '2026-09-12T00:00:00Z' },
          { id: 'old', created_at: '2026-08-01T00:00:00Z' },
        ],
        'new'
      ),
      2
    )
  })
})
