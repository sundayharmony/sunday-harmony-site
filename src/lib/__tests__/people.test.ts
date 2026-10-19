import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  filterPeople,
  findPersonById,
  groupPeople,
  groupPeopleByLane,
  personLane,
  personMatchesFilter,
  selectPeopleWhoOwe,
  selectReferralPayouts,
  selectUpcomingConsultations,
  selectWaitingApplications,
  sortPeople,
  summarizePeople,
  personOwesMoney,
  applicationIsCompleted,
  type PeopleInput,
} from '../people'

const now = new Date('2026-10-18T15:00:00.000Z')

function records(): PeopleInput {
  return {
    leads: [
      {
        id: 'lead-1',
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'Ada@Example.com',
        phone: '555-0100',
        business: 'Analytical Engines',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'lead-2',
        first_name: 'Grace',
        last_name: 'Hopper',
        email: 'grace@navy.test',
        business: 'Compilers',
        created_at: '2026-02-01T00:00:00.000Z',
      },
    ],
    clients: [
      {
        id: 'client-1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        business: 'Analytical Engines',
        billing_status: 'paid',
        repair_fee_cents: 15000,
        repair_fee_paid_at: null,
        created_at: '2026-03-01T00:00:00.000Z',
      },
    ],
    applications: [
      {
        id: 'app-1',
        email: 'ada@example.com',
        full_name: 'Ada Lovelace',
        status: 'under_review',
        created_at: '2026-04-01T00:00:00.000Z',
      },
    ],
    bookings: [
      {
        id: 'book-1',
        guest_name: 'Ada Lovelace',
        guest_email: 'ADA@example.com',
        starts_at: '2026-10-20T15:00:00.000Z',
        status: 'scheduled',
        meet_link: 'https://meet.example/ada',
        created_at: '2026-10-01T00:00:00.000Z',
      },
      {
        id: 'book-far',
        guest_name: 'Grace Hopper',
        guest_email: 'grace@navy.test',
        starts_at: '2026-12-01T15:00:00.000Z',
        status: 'scheduled',
        created_at: '2026-10-02T00:00:00.000Z',
      },
    ],
  }
}

describe('people resolver', () => {
  it('collapses a lead, client, and booking that share an email into one person', () => {
    const people = groupPeople(records(), now)
    const ada = people.find((person) => person.email === 'ada@example.com')
    assert.ok(ada)
    assert.equal(ada.id, 'client-1')
    assert.equal(ada.leadId, 'lead-1')
    assert.equal(ada.clientId, 'client-1')
    assert.equal(ada.applicationId, 'app-1')
    assert.equal(ada.hasCreditWork, true)
    assert.equal(ada.owesMoney, true)
    assert.equal(ada.oweLabel, 'Repair fee unpaid')
    assert.equal(ada.nextConsultationAt, '2026-10-20T15:00:00.000Z')
    assert.equal(people.filter((person) => person.email === 'ada@example.com').length, 1)
    assert.equal(findPersonById(people, 'lead-1')?.id, 'client-1')
    assert.equal(findPersonById(people, 'book-1')?.id, 'client-1')
  })

  it('keeps a marketing-only person out of the credit list', () => {
    const people = groupPeople(records(), now)
    const credit = filterPeople(people, 'credit')
    assert.equal(credit.some((person) => person.email === 'grace@navy.test'), false)
    assert.equal(credit.some((person) => person.email === 'ada@example.com'), true)
  })

  it('leaves rows with no email as separate people', () => {
    const people = groupPeople({
      leads: [{ id: 'lead-x', first_name: 'No', last_name: 'Mail', business: 'Walk-in', created_at: '2026-01-01T00:00:00.000Z' }],
      clients: [{ id: 'client-x', name: 'Also Blank', business: 'Other', created_at: '2026-01-02T00:00:00.000Z' }],
      applications: [],
      bookings: [],
    }, now)
    assert.equal(people.length, 2)
    assert.deepEqual(people.map((person) => person.id).sort(), ['client-x', 'lead-x'])
  })

  it('detects past due, unpaid, and a paid repair fee', () => {
    assert.equal(personOwesMoney({ billing_status: 'past_due' }), true)
    assert.equal(personOwesMoney({ billing_status: 'unpaid' }), true)
    assert.equal(personOwesMoney({ billing_status: 'paid', repair_fee_cents: 100, repair_fee_paid_at: null }), true)
    assert.equal(personOwesMoney({ billing_status: 'paid', repair_fee_cents: 100, repair_fee_paid_at: '2026-01-01' }), false)
    assert.equal(personOwesMoney({ billing_status: 'paid', repair_fee_cents: 0 }), false)
  })

  it('queues the next week of consultations, waiting applications, balances, and ready payouts', () => {
    const people = groupPeople(records(), now)
    const source = records()
    const upcoming = selectUpcomingConsultations(people, source.bookings, now)
    assert.deepEqual(upcoming.map((row) => row.bookingId), ['book-1'])
    assert.equal(upcoming[0].personId, 'client-1')

    const waiting = selectWaitingApplications(people, source.applications)
    assert.equal(waiting.length, 1)
    assert.equal(waiting[0].applicationId, 'app-1')

    const owes = selectPeopleWhoOwe(people)
    assert.equal(owes.length, 1)
    assert.equal(owes[0].personId, 'client-1')

    const payouts = selectReferralPayouts(people, [
      { clientId: 'client-1', availableCents: 2500, name: 'Ada', email: 'ada@example.com' },
      { clientId: 'client-1', availableCents: 0, name: 'Ada', email: 'ada@example.com' },
    ])
    assert.equal(payouts.length, 1)
    assert.equal(payouts[0].availableCents, 2500)
    assert.equal(payouts[0].personId, 'client-1')
  })
})

describe('people list organization', () => {
  it('puts each person in one lane and counts that lane', () => {
    const people = groupPeople(records(), now)
    const ada = people.find((person) => person.email === 'ada@example.com')
    const grace = people.find((person) => person.email === 'grace@navy.test')
    assert.equal(personLane(ada!, 'all'), 'owes')
    assert.equal(personLane(grace!, 'all'), 'consultation')
    assert.equal(personMatchesFilter(ada!, 'owes'), true)
    assert.equal(personMatchesFilter(ada!, 'waiting'), false)
    assert.equal(personMatchesFilter(grace!, 'credit'), false)

    const stats = summarizePeople(people)
    assert.equal(stats.total, 2)
    assert.equal(stats.owes, 1)
    assert.equal(stats.waiting, 0)
    assert.equal(stats.consultations, 1)
    assert.equal(stats.credit, 0)
    assert.equal(stats.completed, 0)
    assert.equal(stats.clients, 0)
    assert.equal(stats.contacts, 0)

    const groups = groupPeopleByLane(people, 'name')
    assert.deepEqual(groups.map((group) => group.lane), ['owes', 'consultation'])
    assert.equal(sortPeople(people, 'name')[0].name, 'Ada Lovelace')
    assert.equal(sortPeople(people, 'consultation')[0].email, 'ada@example.com')
  })

  it('keeps a credit manager list inside owes, waiting, and credit', () => {
    const people = filterPeople(groupPeople(records(), now), 'credit')
    const groups = groupPeopleByLane(people, 'newest', 'credit')
    assert.deepEqual(groups.map((group) => group.lane), ['owes'])
    assert.equal(groups[0].people[0].email, 'ada@example.com')
  })

  it('groups credit analysis complete and completed applications in the completed lane', () => {
    assert.equal(applicationIsCompleted('credit_analysis_complete'), true)
    assert.equal(applicationIsCompleted('completed'), true)
    assert.equal(applicationIsCompleted('under_review'), false)

    const people = groupPeople({
      leads: [],
      clients: [{ id: 'c1', name: 'Charle', email: 'charle@test.com', created_at: '2026-01-01T00:00:00.000Z' }],
      applications: [
        {
          id: 'app-done',
          email: 'charle@test.com',
          full_name: 'Charle C.',
          status: 'credit_analysis_complete',
          created_at: '2026-02-01T00:00:00.000Z',
        },
      ],
      bookings: [],
    }, now)
    assert.equal(personLane(people[0], 'all'), 'completed')
    const stats = summarizePeople(people)
    assert.equal(stats.completed, 1)
    assert.equal(stats.credit, 0)
    const groups = groupPeopleByLane(people, 'name')
    assert.deepEqual(groups.map((group) => group.lane), ['completed'])
  })
})

describe('people admin wiring', () => {
  it('shrinks the daily sidebar and keeps credit managers on Today', () => {
    const sidebar = readFileSync('src/components/admin/AdminSidebar.tsx', 'utf8')
    const middleware = readFileSync('src/middleware.ts', 'utf8')
    const login = readFileSync('src/lib/login-redirect.ts', 'utf8')
    const booking = readFileSync('src/lib/consultation-service.ts', 'utf8')
    const redirects = readFileSync('next.config.js', 'utf8')

    assert.match(sidebar, /label: 'Today'/)
    assert.match(sidebar, /label: 'People'/)
    assert.match(sidebar, /label: 'Partners'/)
    assert.match(sidebar, /label: 'Settings'/)
    assert.doesNotMatch(sidebar, /\/admin\/crm/)
    assert.doesNotMatch(sidebar, /\/admin\/credit-funding/)
    assert.match(middleware, /if \(path === '\/admin'\) return true/)
    assert.match(login, /if \(role === 'credit_manager'\) return '\/admin'/)
    assert.match(booking, /findLeadByEmail/)
    assert.match(booking, /marketing_lead_status !== 'converted'/)
    assert.match(redirects, /source: '\/admin\/crm'/)
    assert.doesNotMatch(redirects, /source: '\/admin\/credit-funding'/)
    assert.doesNotMatch(redirects, /source: '\/admin\/consultations'/)
  })
})
