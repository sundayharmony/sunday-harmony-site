import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  emptyLettersError,
  letterGenerateFailure,
  isLetterGenerateTerminal,
} from '../dispute-letters/generate-job'

describe('letterGenerateFailure', () => {
  it('rejects stream-style error payloads', () => {
    assert.equal(
      letterGenerateFailure({ error: 'Session not found' }),
      'Session not found'
    )
  })

  it('rejects failed jobs', () => {
    assert.equal(
      letterGenerateFailure({ status: 'failed', error_message: 'boom' }),
      'boom'
    )
  })

  it('rejects complete jobs with zero letters and names skipped furnishers', () => {
    const message = letterGenerateFailure({
      status: 'complete',
      letters: [],
      skipped: [
        { plan_id: 'p1', recipient_name: 'KIKOFF LENDING LLC', reason: 'missing_address' },
      ],
    })
    assert.match(message || '', /KIKOFF LENDING LLC/)
  })

  it('accepts complete jobs that produced letters', () => {
    assert.equal(
      letterGenerateFailure({
        status: 'complete',
        letters: [{ id: 'l1', title: 'Experian — 1 item(s)' }],
        skipped: [{ plan_id: 'p1', recipient_name: 'KIKOFF', reason: 'missing_address' }],
      }),
      null
    )
  })

  it('does not fail in-progress jobs', () => {
    assert.equal(letterGenerateFailure({ status: 'generating', current: 1, total: 3 }), null)
    assert.equal(isLetterGenerateTerminal({ status: 'generating' }), false)
    assert.equal(isLetterGenerateTerminal({ status: 'complete' }), true)
  })
})

describe('emptyLettersError', () => {
  it('explains a fully skipped run', () => {
    assert.equal(emptyLettersError([]), 'No letters were generated.')
  })
})
