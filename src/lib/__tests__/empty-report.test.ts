import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { emptyReportMessage, readAccountCount } from '../dispute-letters/empty-report'
import type { ParsedReport } from '../dispute-letters/types'

const base = { tradelines: [], ocr_used: false } as unknown as ParsedReport

describe('empty report warning', () => {
  it('warns about the layout when a text report has no accounts', () => {
    assert.match(emptyReportMessage(base) || '', /layout is not one the system knows/)
  })
  it('warns about the scan when OCR read little text', () => {
    const scan = { ...base, ocr_used: true, extraction_quality: 'low' } as ParsedReport
    assert.match(emptyReportMessage(scan) || '', /scan or screenshot/)
    assert.match(emptyReportMessage(scan) || '', /all at once/)
  })
  it('blames the layout, not the scan, when OCR read plenty of text', () => {
    const read = { ...base, ocr_used: true, extraction_quality: 'medium' } as ParsedReport
    assert.match(emptyReportMessage(read) || '', /layout is not one the system knows/)
  })
  it('ignores inquiry rows and stays quiet once accounts are read', () => {
    const inquiryOnly = { ...base, tradelines: [{ account_type: 'Hard Inquiry', item_category: '' }] } as unknown as ParsedReport
    assert.equal(readAccountCount(inquiryOnly), 0)
    assert.ok(emptyReportMessage(inquiryOnly))
    const withAccount = { ...base, tradelines: [{ account_type: 'Revolving', item_category: '' }] } as unknown as ParsedReport
    assert.equal(emptyReportMessage(withAccount), null)
  })
})
