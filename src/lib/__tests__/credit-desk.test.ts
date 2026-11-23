import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCreditQueue,
  clientPhase,
  creditInsights,
  creditPulse,
  emptyItemCounts,
  roundsTracker,
  type DeskClient,
  type DeskRound,
} from '@/lib/credit-desk'

const NOW = new Date('2026-11-23T17:00:00.000Z')
const ago = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString()

// Fake people only. Real client data never belongs in tests.
function client(partial: Partial<DeskClient> & { id: string }): DeskClient {
  return {
    applicationId: `CF-${partial.id}`,
    name: `Test Person ${partial.id}`,
    email: `${partial.id}@example.test`,
    phone: '555-0100',
    status: 'under_review',
    serviceType: 'credit_repair',
    assignedSpecialist: 'expert-1',
    expertName: 'Expert One',
    clientId: null,
    createdAt: ago(10),
    updatedAt: ago(1),
    lastApplicantMessageAt: null,
    lastStaffMessageAt: null,
    pendingRequests: 0,
    oldestPendingRequestAt: null,
    feeCents: null,
    feePaidAt: null,
    billingModel: null,
    rounds: [],
    items: emptyItemCounts(),
    ...partial,
  }
}

function round(partial: Partial<DeskRound>): DeskRound {
  return {
    id: 'r', applicationUuid: 'a', roundNumber: 1, status: 'awaiting_response', sessionId: 's',
    startedAt: ago(20), mailedAt: ago(20), deliveredAt: null, deadlineAt: null, ...partial,
  }
}

describe('client phase', () => {
  it('treats a client with letters out as disputing even while the status still says Under review', () => {
    assert.equal(clientPhase(client({ id: 'a' })), 'review')
    assert.equal(clientPhase(client({ id: 'b', rounds: [round({})] })), 'disputing')
    assert.equal(clientPhase(client({ id: 'c', items: { ...emptyItemCounts(), selected: 3 } })), 'disputing')
    assert.equal(clientPhase(client({ id: 'd', status: 'invitation_pending' })), 'intake')
    assert.equal(clientPhase(client({ id: 'e', status: 'funding_review' })), 'funding')
    assert.equal(clientPhase(client({ id: 'f', status: 'completed', rounds: [round({})] })), 'done')
  })
})

describe('credit queue', () => {
  it('orders the work and puts each client in one group', () => {
    const clients = [
      client({ id: 'msg', lastApplicantMessageAt: ago(2), lastStaffMessageAt: ago(5), rounds: [round({ deadlineAt: ago(1) })] }),
      client({ id: 'late', rounds: [round({ deadlineAt: ago(4) })] }),
      client({ id: 'ready', rounds: [round({ status: 'letters_ready', startedAt: ago(5), mailedAt: null })] }),
      client({ id: 'new', status: 'submitted', createdAt: ago(3), assignedSpecialist: null }),
      client({ id: 'soon', rounds: [round({ deadlineAt: new Date(NOW.getTime() + 3 * 86400000).toISOString() })] }),
      client({ id: 'docs', pendingRequests: 2, oldestPendingRequestAt: ago(6) }),
      client({ id: 'fee', clientId: 'c1', billingModel: 'credit_repair_one_time', feeCents: 49900 }),
      client({ id: 'invite', status: 'invitation_pending', updatedAt: ago(20) }),
      client({ id: 'done', status: 'completed', lastApplicantMessageAt: ago(1) }),
    ]
    const groups = buildCreditQueue(clients, 'admin', NOW)
    assert.deepEqual(groups.map((g) => [g.key, g.items.map((i) => i.id)]), [
      ['client_waiting', ['msg']],
      ['deadline_passed', ['late']],
      ['letters_ready', ['ready']],
      ['new_submission', ['new']],
      ['deadline_soon', ['soon']],
      ['docs_waiting', ['docs']],
      ['fee_unpaid', ['fee']],
      ['stale_invite', ['invite']],
    ])
    const get = (id: string) => groups.flatMap((g) => g.items).find((i) => i.id === id)!
    assert.match(get('late').reason, /Round 1 deadline passed 4 days ago/)
    assert.match(get('soon').reason, /due in 3 days/)
    assert.match(get('fee').reason, /\$499 repair fee unpaid/)
    assert.equal(get('new').advanceTo, 'under_review')
    assert.equal(get('new').unassigned, true)
  })

  it('shows unassigned clients only to admins, and only once', () => {
    const clients = [client({ id: 'x', assignedSpecialist: null }), client({ id: 'y', status: 'submitted', assignedSpecialist: null })]
    assert.deepEqual(buildCreditQueue(clients, 'admin', NOW).map((g) => g.key), ['new_submission', 'unassigned'])
    assert.deepEqual(buildCreditQueue(clients, 'credit_manager', NOW).map((g) => g.key), ['new_submission'])
  })

  it('does not nag about a reply staff already sent', () => {
    const groups = buildCreditQueue([client({ id: 'a', lastApplicantMessageAt: ago(3), lastStaffMessageAt: ago(1) })], 'admin', NOW)
    assert.equal(groups.length, 0)
  })
})

describe('pulse, rounds, insights', () => {
  const clients = [
    client({ id: 'a', rounds: [round({ id: 'r1', deadlineAt: ago(2) }), round({ id: 'r0', roundNumber: 0 as number, status: 'closed' })], items: { ...emptyItemCounts(), disputed: 5, deleted: 2, verified: 1 } }),
    client({ id: 'b', rounds: [round({ id: 'r2', status: 'letters_ready', deadlineAt: null })], clientId: 'c', billingModel: 'credit_repair_one_time', feeCents: 50000, feePaidAt: ago(3) }),
    client({ id: 'c', status: 'submitted', clientId: 'd', billingModel: 'credit_repair_one_time', feeCents: 30000, assignedSpecialist: null }),
  ]

  it('sums the pulse from saved facts', () => {
    const pulse = creditPulse(clients, NOW)
    assert.deepEqual(pulse.phases.map((p) => p.count), [0, 1, 2, 0, 0])
    assert.equal(pulse.openRounds, 2)
    assert.equal(pulse.lettersToMail, 1)
    assert.equal(pulse.deadlinesThisWeek, 1)
    assert.equal(pulse.itemsRemoved, 2)
    assert.equal(pulse.feesCollectedCents, 50000)
    assert.equal(pulse.feesOwedCents, 30000)
    assert.equal(pulse.unassigned, 1)
  })

  it('lists past-deadline rounds first', () => {
    assert.deepEqual(roundsTracker(clients, NOW).map((r) => [r.id, r.daysLeft]), [['r1', -2], ['r2', null]])
  })

  it('reports outcomes and a removal rate from answered items only', () => {
    const insights = creditInsights(clients)
    assert.equal(insights.outcomes.find((o) => o.key === 'deleted')?.count, 2)
    assert.equal(insights.resolvedRate, '67%')
    assert.deepEqual(insights.feeCollection, { paid: 1, owed: 1, notSet: 0 })
  })
})
