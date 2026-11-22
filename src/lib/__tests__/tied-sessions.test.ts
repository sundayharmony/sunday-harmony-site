import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { disputeSessionsTiedToApplication } from '../dispute-letters/tied-sessions'

describe('disputeSessionsTiedToApplication', () => {
  it('keeps only sessions whose application id is this client file', () => {
    const rows = disputeSessionsTiedToApplication(
      [
        { id: 'tied', application_uuid: 'app-1' },
        { id: 'other', application_uuid: 'app-2' },
        { id: 'loose', application_uuid: null },
        { id: 'blank', application_uuid: '  ' },
      ],
      ' app-1 '
    )
    assert.deepEqual(rows.map((row) => row.id), ['tied'])
  })

  it('returns nothing when the client file has no id', () => {
    assert.deepEqual(
      disputeSessionsTiedToApplication([{ id: 'tied', application_uuid: 'app-1' }], ' '),
      []
    )
  })
})
