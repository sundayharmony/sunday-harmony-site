import assert from 'node:assert/strict'
import { test } from 'node:test'
import { accountOutcomesFromItems } from '../credit-intelligence-resolve'

test('deleted wins when the same account also has a verified row', () => {
  const outcomes = accountOutcomesFromItems([
    { creditor_name: 'ABC Collections', account_last4: '1234', current_status: 'verified' },
    { creditor_name: 'ABC Collections', account_last4: '···1234', current_status: 'deleted' },
    { creditor_name: 'XYZ Collections', account_last4: '5678', current_status: 'no_response' },
    { creditor_name: 'Pending Bank', account_last4: '9999', current_status: 'disputed' },
  ])
  assert.deepEqual(
    outcomes.map((item) => [item.creditor, item.account_last4, item.status]).sort(),
    [
      ['ABC Collections', '1234', 'deleted'],
      ['XYZ Collections', '5678', 'no_response'],
    ]
  )
})
