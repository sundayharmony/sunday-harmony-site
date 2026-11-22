import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { reportJsonWithoutFullSsn } from '../dispute-letters/db'
import type { ParsedReport } from '../dispute-letters/types'

function reportWithSsn(ssn: string): ParsedReport {
  return {
    consumer: { name: 'Jane', dob: '', ssn, ssn_last4: '6789', addresses: [] },
  } as unknown as ParsedReport
}

describe('report JSON SSN storage', () => {
  it('drops a full SSN from the saved copy and leaves the intake-backed value in memory', () => {
    const report = reportWithSsn('123-45-6789')
    const stored = reportJsonWithoutFullSsn(report)
    assert.equal(stored.consumer.ssn, '')
    assert.equal(stored.consumer.ssn_last4, '6789')
    assert.equal(report.consumer.ssn, '123-45-6789')
  })

  it('leaves a last-four value on the report', () => {
    const report = reportWithSsn('6789')
    assert.equal(reportJsonWithoutFullSsn(report).consumer.ssn, '6789')
  })
})
