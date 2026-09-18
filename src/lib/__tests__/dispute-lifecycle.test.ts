import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MAX_ITEMS_PER_LETTER,
  ROUND_1_MAX_ITEMS_PER_BUREAU,
  buildCfpbComplaintDraft,
  buildLetterPackageSnapshot,
  chunkItems,
  comparisonUpdatesForItems,
  computeDeadlineAt,
  countSelectionsPerBureau,
  disputeLettersZipDownloadNameForRound,
  enforceRound1BureauCaps,
  expandTradelineSelections,
  enrichPlanSelectionsWithItemStatus,
  formatStatusHistory,
  isFollowUpOutcomeStatus,
  isRoundClosedForNext,
  isRoundFullySent,
  itemIdentityFromTradeline,
  itemStatusLabel,
  itemWorkflowStage,
  letterChunkCount,
  letterIdsSignature,
  letterPackageDisplayCode,
  nextRoundNumber,
  notYetDisputedFromItems,
  pendingIdentitiesFromTradelines,
  pendingQueueFromItems,
  findItemForIdentity,
  groupItemsByAccountNumber,
  uniqueItemsByAccountNumber,
  roundWorkflowView,
  shouldAppendStatusEvent,
  shouldReuseLetterPackage,
  splitWorkflowQueues,
  hasUpdatedReportForNextRound,
  suggestFollowUpLetterType,
  type DisputeItemRow,
  type LetterPackageRow,
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

function item(partial: Partial<DisputeItemRow> & Pick<DisputeItemRow, 'id' | 'current_status'>): DisputeItemRow {
  return {
    case_id: 'c',
    match_key: partial.id,
    creditor_name: 'Creditor',
    account_last4: '0000',
    bureau: 'TUC',
    account_type: 'Card',
    last_round_number: 1,
    last_letter_type: 'bureau',
    notes: null,
    created_at: '',
    updated_at: '',
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
      item({
        id: '1',
        match_key: 'a',
        creditor_name: 'Verified Bank',
        account_last4: '1111',
        bureau: 'TUC',
        current_status: 'verified',
      }),
      item({
        id: '2',
        match_key: 'b',
        creditor_name: 'Deleted Co',
        account_last4: '2222',
        bureau: 'EXP',
        current_status: 'deleted',
      }),
      item({
        id: '3',
        match_key: 'c',
        creditor_name: 'No Reply LLC',
        account_last4: '3333',
        bureau: 'EQF',
        account_type: 'Collection',
        current_status: 'no_response',
      }),
    ]
    const queue = pendingQueueFromItems(items)
    assert.equal(queue.length, 2)
    assert.ok(queue.every((i) => i.current_status !== 'deleted'))
  })

  it('keeps not-yet-disputed items out of the next-round queue until a round is fully sent', () => {
    const items: DisputeItemRow[] = [
      item({ id: 'p', creditor_name: 'Pending Bank', current_status: 'pending', last_round_number: null }),
      item({
        id: 's',
        creditor_name: 'Selected Bank',
        current_status: 'selected_for_round',
      }),
      item({ id: 'd', creditor_name: 'Disputed Bank', current_status: 'disputed' }),
    ]
    const pending = notYetDisputedFromItems(items)
    const nextRound = pendingQueueFromItems(items)
    assert.deepEqual(
      pending.map((i) => i.current_status),
      ['pending', 'selected_for_round']
    )
    assert.deepEqual(
      nextRound.map((i) => i.current_status),
      []
    )
  })

  it('expands unselected negatives and inquiries into pending identities', () => {
    const identities = pendingIdentitiesFromTradelines([
      tl({
        id: 'neg',
        creditor: 'Collections Inc',
        is_collection: true,
        selected: false,
        bureaus: ['TUC', 'EXP', 'EQF'],
        account_tu: '****1111',
        account_exp: '****1111',
        account_eqf: '****1111',
      }),
      tl({
        id: 'inq',
        creditor: 'Hard Pull LLC',
        status: 'Inquiry',
        item_category: 'inquiry',
        selected: false,
        bureaus: ['EXP'],
        account_exp: '****9999',
      }),
      tl({
        id: 'good',
        creditor: 'Clean Card',
        status: 'Open',
        remarks: 'Never late',
        selected: false,
        bureaus: ['TUC'],
        account_tu: '****2222',
      }),
    ])
    assert.equal(identities.length, 4)
    assert.ok(identities.every((i) => i.creditorName !== 'Clean Card'))
    assert.equal(identities.filter((i) => i.creditorName === 'Collections Inc').length, 3)
    assert.equal(identities.filter((i) => i.creditorName === 'Hard Pull LLC').length, 1)
  })

  it('collapses renamed creditors with the same bureau last4 into one pending identity', () => {
    const identities = pendingIdentitiesFromTradelines([
      tl({
        id: 'kikoff-short',
        creditor: 'KIKOFF',
        is_collection: true,
        bureaus: ['EXP'],
        account_exp: '****1111',
      }),
      tl({
        id: 'kikoff-long',
        creditor: 'KIKOFF LENDING LLC',
        is_collection: true,
        bureaus: ['EXP'],
        account_exp: 'XXXX1111',
      }),
    ])
    assert.equal(identities.length, 1)
    assert.equal(identities[0].matchKey, 'a4:EXP:1111')
  })

  it('finds an old c4 match_key item from a new a4 identity', () => {
    const existing = item({
      id: 'old',
      match_key: 'c4:EXP:kikoff lending llc:1111',
      account_last4: '1111',
      bureau: 'EXP',
      creditor_name: 'KIKOFF LENDING LLC',
      current_status: 'disputed',
    })
    const found = findItemForIdentity([existing], {
      bureau: 'EXP',
      accountLast4: '1111',
      matchKey: 'a4:EXP:1111',
    })
    assert.equal(found?.id, 'old')
  })

  it('names ZIP files with the real round number', () => {
    assert.equal(
      disputeLettersZipDownloadNameForRound('Jane Doe', 2),
      'Jane Doe round 2 Letters.zip'
    )
    assert.equal(disputeLettersZipDownloadNameForRound('', 0), 'Client round 1 Letters.zip')
  })

  it('suggests follow-up letter types from item status and round', () => {
    assert.equal(
      suggestFollowUpLetterType({ itemStatus: 'verified', roundNumber: 2 }),
      'method_of_verification'
    )
    assert.equal(
      suggestFollowUpLetterType({ itemStatus: 'verified', roundNumber: 3 }),
      'cfpb_complaint'
    )
    assert.equal(
      suggestFollowUpLetterType({ itemStatus: 'no_response', roundNumber: 2 }),
      'warning_intent'
    )
    assert.equal(
      suggestFollowUpLetterType({ itemStatus: 'updated', roundNumber: 2 }),
      'reinvestigation'
    )
    assert.equal(
      suggestFollowUpLetterType({ isCollection: true, roundNumber: 2 }),
      'debt_validation'
    )
    assert.equal(
      suggestFollowUpLetterType({
        itemStatus: 'verified',
        preferred: 'furnisher',
        roundNumber: 3,
      }),
      'furnisher'
    )
  })

  it('computes bureau response deadlines from delivery or mail date', () => {
    assert.equal(computeDeadlineAt({}), null)
    const fromDelivery = computeDeadlineAt({
      deliveredAt: '2026-01-01T12:00:00.000Z',
      mailedAt: '2025-12-20T12:00:00.000Z',
    })
    assert.equal(fromDelivery, '2026-01-31T12:00:00.000Z')
    const fromMail = computeDeadlineAt({ mailedAt: '2026-02-01T08:00:00.000Z' })
    assert.equal(fromMail, '2026-03-03T08:00:00.000Z')
  })

  it('builds a CFPB complaint draft from unresolved items', () => {
    const draft = buildCfpbComplaintDraft({
      consumerName: 'Alex Consumer',
      items: [
        {
          creditorName: 'Capital One',
          accountLast4: '1234',
          bureau: 'TUC',
          currentStatus: 'verified',
          notes: 'Still on file',
        },
      ],
      roundSummary: 'Round 2 mailed; no deletion.',
    })
    assert.match(draft, /# CFPB complaint draft: Alex Consumer/)
    assert.match(draft, /Capital One ···1234 \(TUC\)/)
    assert.match(draft, /status: verified/)
    assert.match(draft, /Still on file/)
    assert.match(draft, /Round 2 mailed/)
    assert.match(draft, /consumerfinance\.gov/)
  })

  it('does not treat in-progress item statuses as follow-up outcomes', () => {
    assert.equal(isFollowUpOutcomeStatus('disputed'), false)
    assert.equal(isFollowUpOutcomeStatus('selected_for_round'), false)
    assert.equal(isFollowUpOutcomeStatus('pending'), false)
    assert.equal(isFollowUpOutcomeStatus('verified'), true)
    assert.equal(isFollowUpOutcomeStatus('no_response'), true)
  })

  it('does not stamp disputed/selected_for_round onto Round 1 plan selections', () => {
    const tradeline = tl({
      id: 'cap1',
      creditor: 'Capital One',
      account_tu: '****1111',
      selected: true,
      dispute_bureaus: ['TUC'],
    })
    const identity = itemIdentityFromTradeline(tradeline, 'TUC')
    assert.ok(identity)
    const disputed: DisputeItemRow = {
      id: 'item-1',
      case_id: 'c',
      match_key: identity.matchKey,
      creditor_name: 'Capital One',
      account_last4: '1111',
      bureau: 'TUC',
      account_type: 'Credit Card',
      current_status: 'disputed',
      last_round_number: 1,
      last_letter_type: 'bureau',
      notes: null,
      created_at: '',
      updated_at: '',
    }
    const stripped = enrichPlanSelectionsWithItemStatus(
      [{ id: 'cap1', selected: true, item_status: 'disputed' }],
      [tradeline],
      [disputed]
    )
    assert.equal(stripped[0].item_status, undefined)

    const verified = { ...disputed, current_status: 'verified' as const }
    const stamped = enrichPlanSelectionsWithItemStatus(
      [{ id: 'cap1', selected: true, item_status: undefined as string | undefined }],
      [tradeline],
      [verified]
    )
    assert.equal(stamped[0].item_status, 'verified')
  })

  it('does not treat generated letters as sent until sent_at is set', () => {
    const generated = item({ id: 'g', current_status: 'selected_for_round' })
    const legacy = item({ id: 'l', current_status: 'disputed' })
    const sent = item({
      id: 's',
      current_status: 'disputed',
      sent_at: '2026-09-15T12:00:00.000Z',
    })
    assert.equal(
      itemWorkflowStage(generated, { id: 'r', case_id: 'c', round_number: 1, status: 'letters_ready' } as never),
      'letter_generated'
    )
    assert.equal(itemWorkflowStage(legacy), 'letter_generated')
    assert.equal(itemWorkflowStage(sent), 'sent')
  })

  it('completes a round only when every assigned item is sent', () => {
    const items = [
      item({ id: 'a', current_status: 'disputed', sent_at: '2026-09-15T12:00:00.000Z' }),
      item({ id: 'b', current_status: 'selected_for_round' }),
    ]
    assert.equal(
      isRoundFullySent({
        round: { id: 'r', case_id: 'c', round_number: 1, status: 'letters_ready' } as never,
        roundItemIds: ['a', 'b'],
        items,
      }),
      false
    )
    items[1] = { ...items[1], sent_at: '2026-09-15T13:00:00.000Z', current_status: 'disputed' }
    assert.equal(
      isRoundFullySent({
        round: { id: 'r', case_id: 'c', round_number: 1, status: 'letters_ready' } as never,
        roundItemIds: ['a', 'b'],
        items,
      }),
      true
    )
  })

  it('moves identified items into next round only after a completed sent round', () => {
    const items = [
      item({ id: 'new', current_status: 'pending', last_round_number: null }),
      item({
        id: 'remain',
        current_status: 'disputed',
        sent_at: '2026-09-15T12:00:00.000Z',
        last_round_number: 1,
      }),
    ]
    const before = splitWorkflowQueues(items)
    assert.equal(before.identified.length, 1)
    assert.equal(before.nextRound.length, 0)
    const after = splitWorkflowQueues(items, null, [1])
    assert.ok(after.nextRound.some((i) => i.id === 'new'))
    assert.ok(after.nextRound.some((i) => i.id === 'remain'))
  })

  it('does not treat the mailed round report or its recorded responses as a next-round update', () => {
    const sessions = [
      {
        id: 'july-tri',
        status: 'ready',
        file_name: 'Mike Webb 3-Bureau Credit Report & Scores.pdf',
        storage_path: 'path/july',
        report_json: { tradelines: [{}] },
      },
      {
        id: 'tu-aug',
        status: 'ready',
        file_name: 'Mike Webb Transunion 8-24-2026.pdf',
        storage_path: 'path/tu',
        report_json: { tradelines: [{}] },
      },
    ]
    assert.equal(
      hasUpdatedReportForNextRound({
        sessions,
        completedRounds: [{ session_id: 'july-tri' }],
        responses: [
          { file_name: 'Mike Webb Transunion 8-24-2026.pdf', storage_path: 'path/tu' },
        ],
      }),
      false
    )
  })

  it('treats a later report that is not a recorded response as the next-round update', () => {
    const sessions = [
      {
        id: 'july-tri',
        status: 'ready',
        file_name: 'Mike Webb 3-Bureau Credit Report & Scores.pdf',
        storage_path: 'path/july',
        report_json: { tradelines: [{}] },
      },
      {
        id: 'oct-exp',
        status: 'ready',
        file_name: 'Mike Webb Experian 10-2026.pdf',
        storage_path: 'path/oct',
        report_json: { tradelines: [{}] },
      },
    ]
    assert.equal(
      hasUpdatedReportForNextRound({
        sessions,
        completedRounds: [{ session_id: 'july-tri' }],
        responses: [],
      }),
      true
    )
  })

  it('chunks letter items at seven', () => {
    assert.equal(MAX_ITEMS_PER_LETTER, 7)
    assert.equal(letterChunkCount(15), 3)
    assert.deepEqual(
      chunkItems(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']).map((c) => c.length),
      [7, 1]
    )
  })

  it('matches renamed creditors to existing items by account last4', () => {
    const sent = item({
      id: 'kikoff-old',
      match_key: 'c4:EXP:kikoff lending llc:1111',
      account_last4: '1111',
      bureau: 'EXP',
      creditor_name: 'KIKOFF LENDING LLC',
      current_status: 'disputed',
      sent_at: '2026-07-24T12:00:00.000Z',
    })
    const updates = comparisonUpdatesForItems({
      items: [sent],
      latestMatchKeys: new Set(['a4:EXP:1111']),
      latestCandidateKeys: new Set(['a4:EXP:1111']),
    })
    assert.equal(updates.find((u) => u.id === 'kikoff-old')?.event.stage, 'still_appears')
    assert.equal(updates.find((u) => u.id === 'kikoff-old')?.nextStatus, undefined)
  })

  it('groups duplicate rows that share bureau + last4', () => {
    const a = item({
      id: 'one',
      match_key: 'c4:EXP:comenitycapitalbk bant:4455',
      account_last4: '4455',
      bureau: 'EXP',
      creditor_name: 'COMENITYCAPITALBK/BANT',
    })
    const b = item({
      id: 'two',
      match_key: 'a4:EXP:4455',
      account_last4: '4455',
      bureau: 'EXP',
      creditor_name: 'CCB/BANTER',
    })
    const groups = groupItemsByAccountNumber([a, b])
    assert.equal(groups.length, 1)
    assert.equal(groups[0].length, 2)
    const unique = uniqueItemsByAccountNumber([a, b])
    assert.equal(unique.length, 1)
    assert.equal(unique[0].id, 'one')
  })

  it('marks mailed items deleted when they leave the report', () => {
    const sent = item({
      id: 'gone',
      match_key: 'gone-key',
      current_status: 'disputed',
      sent_at: '2026-09-15T12:00:00.000Z',
    })
    const remain = item({
      id: 'stay',
      match_key: 'stay-key',
      current_status: 'disputed',
      sent_at: '2026-09-15T12:00:00.000Z',
    })
    const updates = comparisonUpdatesForItems({
      items: [sent, remain],
      latestMatchKeys: new Set(['stay-key']),
      latestCandidateKeys: new Set(['stay-key']),
    })
    assert.equal(updates.find((u) => u.id === 'gone')?.nextStatus, 'deleted')
    assert.equal(updates.find((u) => u.id === 'stay')?.event.stage, 'still_appears')
  })

  it('does not treat unsent disputed rows as mailed', () => {
    const stamped = item({
      id: 'legacy',
      match_key: 'legacy-key',
      current_status: 'disputed',
    })
    const updates = comparisonUpdatesForItems({
      items: [stamped],
      latestMatchKeys: new Set(['legacy-key']),
      latestCandidateKeys: new Set(['legacy-key']),
    })
    assert.equal(updates.length, 0)
  })

  it('labels disputed as Letter generated until sent_at exists', () => {
    assert.equal(itemStatusLabel('disputed'), 'Letter generated')
    assert.equal(itemStatusLabel('disputed', '2026-09-15T12:00:00.000Z'), 'Sent')
  })

  it('does not stamp items disputed at plan time; Sent is a separate action', () => {
    const db = readFileSync('src/lib/dispute-letters/dispute-lifecycle-db.ts', 'utf8')
    const readyFn = db.slice(
      db.indexOf('export async function markRoundLettersReady'),
      db.indexOf('export async function updateRoundStatus')
    )
    assert.equal(readyFn.includes("current_status: 'disputed'"), false)
    const planFn = db.slice(
      db.indexOf('export async function syncLifecycleOnPlan'),
      db.indexOf('export async function updateRoundMailTracking')
    )
    assert.equal(planFn.includes('markRoundLettersReady'), false)
    assert.match(db, /export async function markLetterSent/)
    assert.match(db, /export async function onLettersGenerated/)
    assert.match(db, /export async function upsertLetterPackageOnGenerate/)
    assert.match(db, /export async function recordLetterPackageDownload/)
    assert.match(db, /export async function confirmLetterPackageSent/)
    assert.match(db, /export async function repairUnsentDisputedItems/)
    const statusFn = db.slice(
      db.indexOf('export async function updateDisputeItemStatus'),
      db.indexOf('export async function getRoundNumberForSession')
    )
    assert.equal(statusFn.includes('payload.sent_at'), false)
    const generateHook = db.slice(
      db.indexOf('export async function onLettersGenerated'),
      db.indexOf('async function maybeCompleteRoundIfFullySent')
    )
    assert.match(generateHook, /upsertLetterPackageOnGenerate/)
    assert.equal(generateHook.includes("stage: 'sent'"), false)
  })
})

describe('letter package workflow', () => {
  it('labels round progress from selected → generated → ready → awaiting → complete', () => {
    assert.equal(
      roundWorkflowView({ selectedCount: 5, generatedCount: 0, downloaded: false, sentCount: 0 }).label,
      'Selected'
    )
    assert.equal(
      roundWorkflowView({ selectedCount: 5, generatedCount: 5, downloaded: false, sentCount: 0 }).label,
      'Letters generated'
    )
    assert.equal(
      roundWorkflowView({ selectedCount: 5, generatedCount: 5, downloaded: true, sentCount: 0 }).label,
      'Ready to Send'
    )
    assert.equal(
      roundWorkflowView({ selectedCount: 5, generatedCount: 5, downloaded: true, sentCount: 4 }).label,
      'Awaiting 1 Letter'
    )
    assert.equal(
      roundWorkflowView({ selectedCount: 5, generatedCount: 5, downloaded: true, sentCount: 5 }).label,
      'Complete'
    )
  })

  it('reuses a package only when letter IDs match and formats a display code', () => {
    assert.equal(letterIdsSignature(['b', 'a']), 'a,b')
    assert.equal(shouldReuseLetterPackage(['a', 'b'], ['b', 'a']), true)
    assert.equal(shouldReuseLetterPackage(['a'], ['a', 'b']), false)
    assert.equal(shouldReuseLetterPackage([], ['a']), false)
    assert.equal(
      letterPackageDisplayCode('11111111-2222-3333-4444-55555555abcd'),
      'PKG-5555ABCD'
    )
  })

  it('builds a package snapshot without treating download as sent', () => {
    const pkg: LetterPackageRow = {
      id: '11111111-2222-3333-4444-55555555abcd',
      case_id: 'case',
      round_id: 'round',
      session_id: 'session',
      version: 1,
      is_active: true,
      letter_count: 2,
      downloaded_at: '2026-09-16T12:00:00.000Z',
      download_count: 1,
      sent_confirmed_at: null,
      created_at: '2026-09-16T11:00:00.000Z',
      updated_at: '2026-09-16T12:00:00.000Z',
    }
    const snapshot = buildLetterPackageSnapshot({
      package: pkg,
      members: [
        {
          package_id: pkg.id,
          item_id: 'cap1',
          letter_id: 'ltr-1',
          letter_type: 'bureau',
          sent_at: null,
          creditor_name: 'Capital One',
          bureau: 'TUC',
          account_last4: '1111',
          letter_title: 'Capital One Dispute Letter',
        },
        {
          package_id: pkg.id,
          item_id: 'merrick',
          letter_id: 'ltr-2',
          letter_type: 'bureau',
          sent_at: null,
          creditor_name: 'Merrick Bank',
          bureau: 'EXP',
          account_last4: '2222',
          letter_title: 'Merrick Bank Dispute Letter',
        },
      ],
    })
    assert.equal(snapshot.downloaded, true)
    assert.equal(snapshot.allSent, false)
    assert.equal(snapshot.workflow.label, 'Ready to Send')
    assert.equal(snapshot.pendingCount, 2)
  })
})

describe('formatStatusHistory', () => {
  it('does not repeat stage label and detail for the same action', () => {
    const lines = formatStatusHistory([
      {
        at: '2026-09-15T12:00:00.000Z',
        stage: 'selected',
        roundNumber: 1,
        detail: 'Selected for Round 1',
      },
    ])
    assert.equal(lines.length, 1)
    assert.match(lines[0], /09\/15\/2026/)
    assert.match(lines[0], /Round 1/)
    assert.match(lines[0], /Selected for Round 1/)
    assert.ok(!lines[0].includes('Selected for round · Selected for Round 1'))
  })

  it('collapses consecutive duplicate events from repeated round syncs', () => {
    const event = {
      at: '2026-09-15T12:00:00.000Z',
      stage: 'selected' as const,
      roundNumber: 1,
      detail: 'Selected for Round 1',
    }
    const lines = formatStatusHistory([event, event, event, event])
    assert.equal(lines.length, 1)
  })
})

describe('shouldAppendStatusEvent', () => {
  it('blocks back-to-back identical events', () => {
    const history = [
      {
        at: '2026-09-15T12:00:00.000Z',
        stage: 'selected' as const,
        roundNumber: 1,
        detail: 'Selected for Round 1',
      },
    ]
    assert.equal(
      shouldAppendStatusEvent(history, {
        stage: 'selected',
        roundNumber: 1,
        detail: 'Selected for Round 1',
      }),
      false
    )
    assert.equal(
      shouldAppendStatusEvent(history, {
        stage: 'letter_generated',
        roundNumber: 1,
        detail: 'Round 1 letter generated',
      }),
      true
    )
  })
})
