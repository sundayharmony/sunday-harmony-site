import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DAILY_CALL_TARGET,
  buildWorkQueue,
  callAction,
  clientAccounts,
  followUpAfter,
  followUpForOutcome,
  outcomeFromAction,
  prospectTimeline,
  stageAfterCall,
  workspaceInsights,
  workspacePulse,
  type WorkspaceActivity,
  type WorkspaceProspect,
} from '@/lib/marketing-workspace'

const NOW = new Date('2026-11-23T17:00:00.000Z') // Monday, noon in New York

function lead(partial: Partial<WorkspaceProspect> & { id: string }): WorkspaceProspect {
  return {
    business: `Biz ${partial.id}`,
    contactName: 'Pat',
    email: '',
    phone: '555-0100',
    industry: 'Barber shop',
    source: 'outbound',
    stage: 'uncontacted',
    score: 8,
    estimatedValue: 1500,
    followUpAt: null,
    lastContactedAt: null,
    repliedAt: null,
    gmailThreadId: null,
    handedToSalesAt: null,
    handedToRelationsAt: null,
    consultationBookedAt: null,
    agreementSignedAt: null,
    onboarding: {},
    clientId: null,
    createdAt: '2026-11-04T12:00:00.000Z',
    deadline: '',
    deliverables: '',
    opportunity: 'No website',
    notes: 'Research: found on maps',
    ...partial,
  }
}

function activity(partial: Partial<WorkspaceActivity> & { leadId: string; action: string }): WorkspaceActivity {
  return { id: `${partial.leadId}-${partial.action}`, details: '', actor: 'sam@sundayharmony.com', createdAt: NOW.toISOString(), ...partial }
}

describe('call outcomes', () => {
  it('moves early leads to Contacted and never moves an Active client', () => {
    assert.equal(stageAfterCall('sales_closer', 'uncontacted', 'no_answer'), 'contacted')
    assert.equal(stageAfterCall('sales_closer', 'emailed', 'talked'), 'contacted')
    assert.equal(stageAfterCall('sales_closer', 'offer_made', 'talked'), 'offer_made')
    assert.equal(stageAfterCall('sales_closer', 'contacted', 'not_interested'), 'lost_nurture')
    assert.equal(stageAfterCall('admin', 'won', 'not_interested'), 'won')
    assert.equal(stageAfterCall('sales_closer', 'uncontacted', 'wrong_number'), 'uncontacted')
  })

  it('keeps the stage when the role may not make the move', () => {
    assert.equal(stageAfterCall('lead_procurement', 'uncontacted', 'no_answer'), 'uncontacted')
  })

  it('schedules the next call on a weekday at 10am New York time', () => {
    // Friday + 1 day lands on Saturday, so it moves to Monday.
    assert.equal(followUpAfter(1, new Date('2026-11-20T17:00:00.000Z')), '2026-11-23T15:00:00.000Z')
    assert.equal(followUpAfter(2, NOW), '2026-11-25T15:00:00.000Z')
    assert.equal(followUpForOutcome('not_interested', NOW), null)
    assert.equal(followUpForOutcome('wrong_number', NOW), undefined)
  })

  it('round-trips the stored action', () => {
    assert.equal(outcomeFromAction(callAction('voicemail')), 'voicemail')
    assert.equal(outcomeFromAction('note'), null)
    assert.equal(outcomeFromAction('call:made_up'), null)
  })
})

describe('work queue', () => {
  it('puts each lead in its most urgent group only', () => {
    const replied = lead({
      id: 'r',
      stage: 'emailed',
      gmailThreadId: 't',
      lastContactedAt: '2026-11-18T12:00:00.000Z',
      repliedAt: '2026-11-22T12:00:00.000Z',
      followUpAt: '2026-11-23T20:00:00.000Z',
    })
    const groups = buildWorkQueue([replied], [], 'sales_closer', NOW)
    assert.deepEqual(groups.map((g) => g.key), ['reply'])
    assert.equal(groups[0].items[0].urgent, true)
  })

  it('drops a reply once someone touched the lead after it', () => {
    const replied = lead({ id: 'r', stage: 'contacted', repliedAt: '2026-11-22T12:00:00.000Z' })
    const groups = buildWorkQueue([replied], [activity({ leadId: 'r', action: 'call:talked', createdAt: '2026-11-22T15:00:00.000Z' })], 'sales_closer', NOW)
    assert.equal(groups.find((g) => g.key === 'reply'), undefined)
  })

  it('ignores stale bulk reminders but keeps today and the last 3 days', () => {
    const groups = buildWorkQueue([
      lead({ id: 'today', stage: 'contacted', followUpAt: '2026-11-23T20:00:00.000Z' }),
      lead({ id: 'missed', stage: 'contacted', followUpAt: '2026-11-21T15:00:00.000Z' }),
      lead({ id: 'stale', stage: 'contacted', followUpAt: '2026-11-11T15:00:00.000Z' }),
    ], [], 'sales_closer', NOW)
    const callbacks = groups.find((g) => g.key === 'callback')
    assert.deepEqual(callbacks?.items.map((i) => i.id), ['missed', 'today'])
    assert.match(callbacks!.items[0].reason, /Missed 2 days ago/)
  })

  it('ranks the call list by score then value and fills to the daily target', () => {
    const prospects = Array.from({ length: 40 }, (_, index) => lead({ id: `c${index}`, score: index % 3 === 0 ? 10 : 7, estimatedValue: index * 10 }))
    prospects.push(lead({ id: 'nophone', phone: '', score: 10 }))
    const calls = buildWorkQueue(prospects, [], 'sales_closer', NOW).find((g) => g.key === 'call')!
    assert.equal(calls.total, 40)
    assert.equal(calls.items.length, DAILY_CALL_TARGET)
    assert.equal(calls.items[0].score, 10)
    assert.ok(!calls.items.some((i) => i.id === 'nophone'))
    const logged = Array.from({ length: 10 }, (_, index) => activity({ leadId: `x${index}`, action: 'call:no_answer', id: `a${index}` }))
    assert.equal(buildWorkQueue(prospects, logged, 'sales_closer', NOW).find((g) => g.key === 'call')!.items.length, DAILY_CALL_TARGET - 10)
  })

  it('skips leads called in the last week', () => {
    const groups = buildWorkQueue([lead({ id: 'a' })], [activity({ leadId: 'a', action: 'call:wrong_number', createdAt: '2026-11-20T15:00:00.000Z' })], 'sales_closer', NOW)
    assert.equal(groups.find((g) => g.key === 'call'), undefined)
  })

  it('shows each role only the groups it works', () => {
    const prospects = [
      lead({ id: 'gap', contactName: '', score: null }),
      lead({ id: 'ready' }),
      lead({ id: 'won', stage: 'won', handedToRelationsAt: '2026-11-20T00:00:00.000Z', onboarding: { welcomed: true } }),
      lead({ id: 'paid', stage: 'won' }),
    ]
    assert.deepEqual(buildWorkQueue(prospects, [], 'lead_procurement', NOW).map((g) => g.key), ['ready_for_sales', 'research'])
    assert.deepEqual(buildWorkQueue(prospects, [], 'client_relations', NOW).map((g) => g.key), ['onboarding'])
    const sales = buildWorkQueue(prospects, [], 'sales_closer', NOW).map((g) => g.key)
    assert.deepEqual(sales, ['handoff_relations', 'call'])
    assert.match(buildWorkQueue(prospects, [], 'client_relations', NOW)[0].items[0].reason, /1 of 5/)
  })

  it('flags offers and quiet emails by days since the last touch', () => {
    const groups = buildWorkQueue([
      lead({ id: 'o', stage: 'offer_made', lastContactedAt: '2026-11-18T12:00:00.000Z', estimatedValue: 2400 }),
      lead({ id: 'e', stage: 'emailed', gmailThreadId: 't', lastContactedAt: '2026-11-14T12:00:00.000Z' }),
      lead({ id: 'fresh', stage: 'emailed', gmailThreadId: 't', lastContactedAt: '2026-11-22T12:00:00.000Z' }),
    ], [], 'admin', NOW)
    assert.match(groups.find((g) => g.key === 'offer')!.items[0].reason, /5 days ago · \$2,400/)
    assert.deepEqual(groups.find((g) => g.key === 'email_no_reply')!.items.map((i) => i.id), ['e'])
  })
})

describe('pulse and insights', () => {
  const prospects = [
    lead({ id: 'a', estimatedValue: 1000 }),
    lead({ id: 'b', stage: 'emailed', gmailThreadId: 't', lastContactedAt: '2026-11-20T12:00:00.000Z', industry: 'Barbershop', estimatedValue: 500 }),
    lead({ id: 'c', stage: 'offer_made', industry: 'Auto repair', score: 6 }),
    lead({ id: 'd', stage: 'won', estimatedValue: 3000, source: 'referral' }),
  ]
  const activities = [
    activity({ leadId: 'a', action: 'call:no_answer', id: '1' }),
    activity({ leadId: 'b', action: 'call:talked', id: '2' }),
    activity({ leadId: 'b', action: 'note', id: '3', createdAt: '2026-11-20T12:00:00.000Z' }),
  ]

  it('counts stages, value, and today from saved facts', () => {
    const pulse = workspacePulse(prospects, activities, [], NOW)
    assert.equal(pulse.stages.find((s) => s.stage === 'uncontacted')?.count, 1)
    assert.equal(pulse.openValue, 1000 + 500 + 1500)
    assert.equal(pulse.wonValue, 3000)
    assert.equal(pulse.callsToday, 2)
    assert.equal(pulse.conversationsToday, 1)
    assert.equal(pulse.notesToday, 0)
  })

  it('builds the funnel, merges spellings of an industry, and buckets activity by day', () => {
    const insights = workspaceInsights(prospects, activities, NOW)
    assert.deepEqual(insights.funnel.map((s) => s.count), [4, 4, 3, 2, 1])
    const barbers = insights.industries.find((row) => row.key === 'barbershop')
    assert.equal(barbers?.total, 3)
    assert.equal(barbers?.label, 'Barber shop')
    assert.equal(insights.activity.length, 14)
    assert.deepEqual(insights.activity.at(-1), { day: '2026-11-23', calls: 2, conversations: 1, notes: 0 })
    assert.equal(insights.activity.at(-4)?.notes, 1)
    assert.equal(insights.sources.find((s) => s.key === 'referral')?.won, 1)
  })
})

describe('client accounts', () => {
  it('ranks at-risk accounts first and explains why', () => {
    const accounts = clientAccounts(
      [
        lead({ id: 'ok', business: 'Alpha', stage: 'won', clientId: 'c1', handedToRelationsAt: 'x', onboarding: { welcomed: true, assets: true, access: true, requirements: true, expectations: true } }),
        lead({ id: 'late', business: 'Beta', stage: 'won', clientId: 'c2', handedToRelationsAt: 'x' }),
        lead({ id: 'open', business: 'Gamma', stage: 'contacted' }),
      ],
      [
        { clientId: 'c2', status: 'pending', dueDate: '2026-11-20', title: 'Logo' },
        { clientId: 'c1', status: 'pending', dueDate: '2026-11-30', title: 'Site' },
      ],
      [
        { id: 'c1', last_payment_at: '2026-11-10T00:00:00Z', monthly_price: 499 },
        { id: 'c2', billing_status: 'past_due' },
      ],
      NOW
    )
    assert.deepEqual(accounts.map((a) => a.id), ['late', 'ok'])
    assert.equal(accounts[0].health, 'at_risk')
    assert.deepEqual(accounts[0].reasons.slice(0, 2), ['1 task overdue', 'Billing past due'])
    assert.equal(accounts[1].health, 'on_track')
    assert.deepEqual(accounts[1].nextTask, { title: 'Site', dueDate: '2026-11-30' })
    assert.equal(accounts[1].billing, 'Paid')
  })
})

describe('timeline', () => {
  it('shows a logged email with its subject instead of the derived one', () => {
    const prospect = lead({ id: 'e', stage: 'emailed', gmailThreadId: 'g', lastContactedAt: '2026-11-21T12:00:00.000Z' })
    const entries = prospectTimeline(prospect, [
      activity({ leadId: 'e', action: 'email_sent', details: 'Marketing opportunity for Biz e', createdAt: '2026-11-21T12:00:00.000Z' }),
    ])
    const emails = entries.filter((entry) => entry.kind === 'email')
    assert.equal(emails.length, 1)
    assert.equal(emails[0].detail, 'Marketing opportunity for Biz e')
  })

  it('merges logged calls and notes with milestones on the lead, newest first', () => {
    const prospect = lead({
      id: 't',
      stage: 'contacted',
      gmailThreadId: 'g',
      lastContactedAt: '2026-11-21T12:00:00.000Z',
      repliedAt: '2026-11-22T12:00:00.000Z',
    })
    const entries = prospectTimeline(prospect, [
      activity({ leadId: 't', action: 'call:voicemail', details: 'Asked for the owner', createdAt: '2026-11-23T14:00:00.000Z' }),
      activity({ leadId: 't', action: 'status_changed', details: 'Updated marketing prospect Biz t (contacted)', createdAt: '2026-11-23T14:00:01.000Z' }),
      activity({ leadId: 'other', action: 'note', details: 'not mine' }),
    ])
    assert.deepEqual(entries.map((e) => e.title), [
      'File updated',
      'Call · Left voicemail',
      'Replied by email',
      'Email sent',
      'Added to the CRM',
    ])
    assert.equal(entries[0].detail, 'Stage: Contacted')
    assert.equal(entries[1].actor, 'sam')
  })
})

describe('ICP call list', () => {
  it('calls the 70+ band and email-band leads with no email, best ICP score first', () => {
    const groups = buildWorkQueue(
      [
        lead({ id: 'call-band', icpBand: 'call', icpScore: 80, icpGaps: ['No website'] }),
        lead({ id: 'email-no-email', icpBand: 'email', icpScore: 60 }),
        lead({ id: 'email-has-email', icpBand: 'email', icpScore: 65, email: 'a@b.com' }),
        lead({ id: 'skip', icpBand: 'no_contact', icpScore: 40 }),
        lead({ id: 'emailed-call', icpBand: 'call', icpScore: 90, stage: 'emailed', gmailThreadId: 't' }),
      ],
      [],
      'sales_closer',
      NOW
    )
    const call = groups.find((g) => g.key === 'call')
    assert.deepEqual(call?.items.map((i) => i.id), ['emailed-call', 'call-band', 'email-no-email'])
    assert.match(call!.items[1].reason, /ICP 80 · No website · Ask for email/)
  })
})
