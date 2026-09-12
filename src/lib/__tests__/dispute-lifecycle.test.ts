import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ROUND_1_MAX_ITEMS_PER_BUREAU,
  countSelectionsPerBureau,
  disputeLettersZipDownloadNameForRound,
  enforceRound1BureauCaps,
  expandTradelineSelections,
  isRoundClosedForNext,
  nextRoundNumber,
  pendingQueueFromItems,
  type DisputeItemRow,
  type RoundSelectionInput,
} from '../dispute-letters/dispute-lifecycle'
import type { Tradeline } from '../dispute-letters/types'

function tl(partial: Partial<Tradeline> & { id: string; creditor: string }): Tradeline {
  return {
    account_tu: '',
    account_exp: '',
    account_eqf: '',
    account_type: 'Credit Card',
    status: 'Open',
    balance: '',
    past_due: '',
    remarks: '',
    bureaus: ['TUC'],
    is_collection: false,
    selected: false,
    dispute_reason: '',
    analysis_notes: '',
    suggested_dispute_reason: '',
    dispute_bureaus: ['TUC'],
    dispute_furnisher: true,
    legal_flags: [],
    repair_priority: 'none',
    item_category: '',
    ...partial,
  }
}

describe('dispute lifecycle rounds', () => {
  it('computes next round numbers', () => {
    assert.equal(nextRoundNumber([]), 1)
    assert.equal(nextRoundNumber([{ round_number: 1 }]), 2)
    assert.equal(nextRoundNumber([{ round_number: 1 }, { round_number: 3 }]), 4)
  })

  it('treats mailed/closed/awaiting as ready for next round', () => {
    assert.equal(isRoundClosedForNext('mailed'), true)
    assert.equal(isRoundClosedForNext('closed'), true)
    assert.equal(isRoundClosedForNext('awaiting_response'), true)
    assert.equal(isRoundClosedForNext('draft'), false)
    assert.equal(isRoundClosedForNext('letters_ready'), false)
  })

  it('enforces Round 1 max items per bureau', () => {
    const selections: RoundSelectionInput[] = []
    for (let i = 0; i < ROUND_1_MAX_ITEMS_PER_BUREAU + 1; i++) {
      selections.push({
        tradeline: tl({
          id: `t${i}`,
          creditor: `Creditor ${i}`,
          account_tu: `****${1000 + i}`,
          selected: true,
          dispute_bureaus: ['TUC'],
        }),
        bureaus: ['TUC'],
      })
    }
    const result = enforceRound1BureauCaps(selections)
    assert.equal(result.ok, false)
    assert.equal(result.violations[0]?.bureau, 'TUC')
    assert.equal(result.violations[0]?.count, ROUND_1_MAX_ITEMS_PER_BUREAU + 1)
  })

  it('allows Round 1 within the per-bureau cap', () => {
    const selections: RoundSelectionInput[] = [
      {
        tradeline: tl({
          id: '1',
          creditor: 'A',
          account_tu: '****1111',
          selected: true,
          dispute_bureaus: ['TUC', 'EXP'],
        }),
        bureaus: ['TUC', 'EXP'],
      },
      {
        tradeline: tl({
          id: '2',
          creditor: 'B',
          account_tu: '****2222',
          selected: true,
          dispute_bureaus: ['TUC'],
        }),
        bureaus: ['TUC'],
      },
    ]
    const result = enforceRound1BureauCaps(selections)
    assert.equal(result.ok, true)
    assert.equal(countSelectionsPerBureau(selections).TUC, 2)
    assert.equal(countSelectionsPerBureau(selections).EXP, 1)
  })

  it('expands selected tradelines into bureau selections', () => {
    const expanded = expandTradelineSelections([
      tl({
        id: '1',
        creditor: 'Cap One',
        selected: true,
        bureaus: ['TUC', 'EXP'],
        dispute_bureaus: ['TUC'],
      }),
      tl({
        id: '2',
        creditor: 'Skipped',
        selected: false,
        dispute_bureaus: ['EQF'],
      }),
    ])
    assert.equal(expanded.length, 1)
    assert.deepEqual(expanded[0].bureaus, ['TUC'])
  })

  it('builds pending queue from unresolved item statuses', () => {
    const items: DisputeItemRow[] = [
      {
        id: '1',
        case_id: 'c',
        match_key: 'a',
        creditor_name: 'Verified Bank',
        account_last4: '1111',
        bureau: 'TUC',
        account_type: 'Card',
        current_status: 'verified',
        last_round_number: 1,
        last_letter_type: 'bureau',
        notes: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        case_id: 'c',
        match_key: 'b',
        creditor_name: 'Deleted Co',
        account_last4: '2222',
        bureau: 'EXP',
        account_type: 'Card',
        current_status: 'deleted',
        last_round_number: 1,
        last_letter_type: 'bureau',
        notes: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: '3',
        case_id: 'c',
        match_key: 'c',
        creditor_name: 'No Reply LLC',
        account_last4: '3333',
        bureau: 'EQF',
        account_type: 'Collection',
        current_status: 'no_response',
        last_round_number: 1,
        last_letter_type: 'bureau',
        notes: null,
        created_at: '',
        updated_at: '',
      },
    ]
    const queue = pendingQueueFromItems(items)
    assert.equal(queue.length, 2)
    assert.ok(queue.every((i) => i.current_status !== 'deleted'))
  })

  it('names ZIP files with the real round number', () => {
    assert.equal(
      disputeLettersZipDownloadNameForRound('Jane Doe', 2),
      'Jane Doe round 2 Letters.zip'
    )
    assert.equal(disputeLettersZipDownloadNameForRound('', 0), 'Client round 1 Letters.zip')
  })
})
