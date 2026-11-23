import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { emptyReportMessage, readAccountCount } from '../dispute-letters/empty-report'
import type { ParsedReport } from '../dispute-letters/types'

const base = { tradelines: [], ocr_used: false } as unknown as ParsedReport

describe('empty report warning', () => {
  it('warns about the layout when a text report has no accounts', () => {
    assert.match(emptyReportMessage(base) || '', /layout is not one the system knows/)
  })
  it('warns about the scan when OCR was used', () => {
    assert.match(emptyReportMessage({ ...base, ocr_used: true }) || '', /scan or screenshot/)
  })
  it('ignores inquiry rows and stays quiet once accounts are read', () => {
    const inquiryOnly = { ...base, tradelines: [{ account_type: 'Hard Inquiry', item_category: '' }] } as unknown as ParsedReport
    assert.equal(readAccountCount(inquiryOnly), 0)
    assert.ok(emptyReportMessage(inquiryOnly))
    const withAccount = { ...base, tradelines: [{ account_type: 'Revolving', item_category: '' }] } as unknown as ParsedReport
    assert.equal(emptyReportMessage(withAccount), null)
  })
})
