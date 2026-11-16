import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { roleMayEditPipeline, roleMayUsePipeline } from '../marketing-crm'
import {
  boardLanes,
  canHandOffToRelations,
  canHandOffToSales,
  canSeeCloseSection,
  closerMayBillProspect,
  directCloseSkipsMeetingAndProposal,
  canMoveStage,
  roleCanEditStage,
  roleCanSeeProspect,
  followUpError,
  homeForRole,
  marketingRoleAllowedPath,
  roleMayOpenProspectFile,
  marketingStatusForStage,
  navForRole,
  roleMayRunSalesActions,
  onboardingComplete,
  STAFF_PIPELINE_STAGES,
  procurementHandoffGaps,
  procurementMetrics,
  salesHandoffGaps,
  salesMetrics,
  stripeHasConfirmedPayment,
  scoreBand,
  scoreTotal,
  stageAfterConsultation,
  stageAfterOutboundEmail,
  stageAfterProspectReply,
  STAGE_LABELS,
  stageFromLegacy,
  stageFromStorage,
  stageToStorage,
  stagesVisibleToRole,
  staffPipelineStage,
  staffStageChoices,
  comparePipelineProspects,
  comparePipelineProspectsBy,
  filterPipelineProspects,
  nextPipelineListSort,
  parsePipelineListSort,
  pipelineProspectMatchesQuery,
  prospectVisibleInBoardStage,
} from '../marketing-pipeline'

describe('marketing pipeline scores and stages', () => {
  it('scores five factors from 0 to 2 and bands the total', () => {
    assert.equal(scoreTotal({ weakness: 2, operating: 2, need: 2, decision_maker: 2, ability: 2 }), 10)
    assert.equal(scoreTotal({ weakness: 3, operating: -1, need: 1.4, decision_maker: 'no', ability: 1 }), 4)
    assert.equal(scoreBand(8), 'high')
    assert.equal(scoreBand(5), 'medium')
    assert.equal(scoreBand(4), 'low')
  })

  it('maps legacy rows and inbound website leads', () => {
    assert.equal(stageFromLegacy({ marketingStatus: 'new_lead', source: 'inbound' }), 'uncontacted')
    assert.equal(stageFromLegacy({ marketingStatus: 'new_lead', source: 'outbound' }), 'uncontacted')
    assert.equal(stageFromLegacy({ marketingStatus: 'consultation_scheduled' }), 'offer_made')
    assert.equal(stageFromLegacy({ legacyStatus: 'proposal' }), 'offer_made')
    assert.equal(stageFromLegacy({ marketingStatus: 'converted' }), 'won')
    assert.equal(marketingStatusForStage('won'), 'converted')
    assert.equal(STAGE_LABELS.won, 'Active client')
    assert.equal(STAGE_LABELS.uncontacted, 'Uncontacted')
    assert.equal(STAGE_LABELS.emailed, 'Emailed')
    assert.equal(STAGE_LABELS.contacted, 'Contacted')
    assert.equal(STAGE_LABELS.offer_made, 'Offer made')
    assert.equal(STAGE_LABELS.lost_nurture, 'Inactive')
    assert.equal(stageFromStorage('ready_to_contact'), 'uncontacted')
    assert.equal(stageFromStorage('contacted'), 'emailed')
    assert.equal(stageFromStorage('negotiation'), 'contacted')
    assert.equal(stageFromStorage('proposal_sent'), 'offer_made')
    assert.equal(stageToStorage('emailed'), 'responded')
    assert.equal(stageToStorage('contacted'), 'negotiation')
    assert.equal(marketingStatusForStage('emailed'), 'contacted')
  })

  it('treats follow-up dates as optional and only set by hand', () => {
    assert.equal(followUpError('uncontacted', ''), null)
    assert.equal(followUpError('uncontacted', null), null)
    assert.equal(followUpError('offer_made', '2026-11-02T15:00:00.000Z'), null)
    assert.match(followUpError('contacted', 'not-a-date') || '', /valid date/)
    assert.equal(followUpError('won', null), null)
    assert.equal(followUpError('lost_nurture', null), null)
    const pipeline = readFileSync('src/components/admin/MarketingPipeline.tsx', 'utf8')
    const followStart = pipeline.indexOf('<span className="font-medium">Follow-up</span>')
    assert.notEqual(followStart, -1)
    const followBlock = pipeline.slice(followStart, pipeline.indexOf('Lead source', followStart))
    assert.match(followBlock, /datetime-local/)
    assert.doesNotMatch(followBlock, /required/)
  })

  it('advances early leads when a consultation is booked and leaves closed deals', () => {
    assert.equal(stageAfterConsultation('emailed'), null)
    assert.equal(stageAfterConsultation('offer_made'), null)
    assert.equal(stageAfterConsultation('won'), null)
    assert.equal(stageAfterOutboundEmail('uncontacted'), 'emailed')
    assert.equal(stageAfterOutboundEmail('emailed'), 'emailed')
    assert.equal(stageAfterOutboundEmail('contacted'), 'contacted')
    assert.equal(stageAfterProspectReply('uncontacted'), 'emailed')
    assert.equal(stageAfterProspectReply('offer_made'), null)
  })

  it('shows Uncontacted through Active client in the stage menu', () => {
    assert.equal(staffPipelineStage('emailed'), 'emailed')
    assert.equal(staffPipelineStage('offer_made'), 'offer_made')
    const admin = staffStageChoices('admin', 'contacted')
    assert.equal(admin.includes('responded' as typeof admin[number]), false)
    assert.equal(admin.includes('meeting_scheduled' as typeof admin[number]), false)
    assert.deepEqual(admin, [...STAFF_PIPELINE_STAGES])
    const prospect = readFileSync('src/components/admin/ProspectFile.tsx', 'utf8')
    const stageStart = prospect.indexOf('<span className="font-medium">Pipeline stage</span>')
    const stageBlock = prospect.slice(stageStart, prospect.indexOf('{editing ? (', stageStart))
    assert.match(stageBlock, /staffStageChoices/)
    assert.doesNotMatch(stageBlock, /PIPELINE_STAGES/)
  })
})

describe('marketing role handoffs and navigation', () => {
  it('blocks a sales handoff until the qualified-lead checklist is complete', () => {
    assert.equal(canHandOffToSales('lead_procurement', 'uncontacted'), true)
    assert.equal(canHandOffToSales('sales_closer', 'uncontacted'), false)
    assert.equal(canHandOffToSales('lead_procurement', 'emailed'), true)
    const gaps = procurementHandoffGaps({
      businessName: 'Abbs Trucking',
      decisionMaker: 'Abbs',
      email: '',
      phone: '',
      marketingOpportunity: 'Website is outdated',
      leadSource: 'outbound',
      notes: 'Owner answered the phone',
      score: 8,
    })
    assert.deepEqual(gaps, ['Email or phone'])
    assert.deepEqual(
      procurementHandoffGaps({
        businessName: 'Abbs Trucking',
        decisionMaker: 'Abbs',
        email: 'a@example.com',
        marketingOpportunity: 'Website',
        leadSource: 'outbound',
        notes: 'Notes',
        score: 8,
      }),
      []
    )
  })

  it('blocks client relations until the close checklist includes a signed agreement and proposal', () => {
    assert.equal(canHandOffToRelations('sales_closer', 'won'), true)
    assert.equal(canHandOffToRelations('sales_closer', 'offer_made'), false)
    const gaps = salesHandoffGaps({
      servicesPurchased: 'Website',
      scope: 'Five pages',
      deliverables: 'Site and logo',
      deadline: 'Dec 1',
      promises: 'Two revision rounds',
      expectations: 'Weekly update',
      agreementSigned: false,
      paymentStatus: 'unpaid',
      proposalUrl: 'https://docs.google.com/document/d/abc',
      stripePaid: true,
    })
    assert.deepEqual(gaps, ['Agreement marked signed'])
  })

  it('treats Stripe last_payment_at or paid status as confirmed payment', () => {
    assert.equal(stripeHasConfirmedPayment(null), false)
    assert.equal(stripeHasConfirmedPayment({ billing_status: 'not_started' }), false)
    assert.equal(stripeHasConfirmedPayment({ billing_status: 'trial' }), false)
    assert.equal(stripeHasConfirmedPayment({ billing_status: 'paid' }), true)
    assert.equal(stripeHasConfirmedPayment({ last_payment_at: '2026-11-05T18:00:00.000Z' }), true)
    assert.equal(canSeeCloseSection('sales_closer', false), false)
    assert.equal(canSeeCloseSection('sales_closer', true), true)
    assert.equal(canSeeCloseSection('lead_procurement', true), false)
    assert.deepEqual(
      salesHandoffGaps({
        servicesPurchased: 'Website',
        scope: 'Five pages',
        deliverables: 'Site and logo',
        deadline: 'Dec 1',
        promises: 'Two revision rounds',
        expectations: 'Weekly update',
        agreementSigned: true,
        proposalUrl: 'https://docs.google.com/document/d/abc',
        stripePaid: false,
      }),
      ['Stripe payment']
    )
  })

  it('skips the meeting and proposal when sales contacted the lead and Stripe shows the invoice paid', () => {
    const contacted = {
      lastContactedAt: '2026-11-04T15:00:00.000Z',
      handedToSalesAt: '2026-11-04T15:00:00.000Z',
      agreementSigned: true,
      stripePaid: true,
    }
    assert.equal(directCloseSkipsMeetingAndProposal(contacted), true)
    assert.equal(directCloseSkipsMeetingAndProposal({ ...contacted, agreementSigned: false }), false)
    assert.equal(directCloseSkipsMeetingAndProposal({ ...contacted, handedToSalesAt: null }), false)
    assert.equal(directCloseSkipsMeetingAndProposal({ ...contacted, stripePaid: false }), false)
    const gaps = salesHandoffGaps({
      servicesPurchased: 'Website',
      scope: 'Five pages',
      deliverables: 'Site and logo',
      deadline: 'Dec 1',
      promises: 'Two revision rounds',
      expectations: 'Weekly update',
      proposalUrl: '',
      ...contacted,
    })
    assert.deepEqual(gaps, [])
    const stillNeedsProposal = salesHandoffGaps({
      servicesPurchased: 'Website',
      scope: 'Five pages',
      deliverables: 'Site and logo',
      deadline: 'Dec 1',
      promises: 'Two revision rounds',
      expectations: 'Weekly update',
      agreementSigned: true,
      stripePaid: true,
      proposalUrl: '',
      lastContactedAt: contacted.lastContactedAt,
      handedToSalesAt: null,
    })
    assert.deepEqual(stillNeedsProposal, ['Proposal Doc'])
  })

  it('moves a lead out of procurement after the sales handoff and into client relations only after the won handoff', () => {
    const uncontacted = { stage: 'uncontacted' as const, handedToSalesAt: null, handedToRelationsAt: null }
    assert.equal(roleCanSeeProspect('lead_procurement', uncontacted), true)
    assert.equal(roleCanSeeProspect('sales_closer', uncontacted), true)
    const emailed = { stage: 'emailed' as const, handedToSalesAt: null, handedToRelationsAt: null }
    assert.equal(roleCanSeeProspect('sales_closer', emailed), false)
    assert.equal(roleCanSeeProspect('lead_procurement', emailed), true)
    assert.equal(roleCanSeeProspect('sales_closer', { stage: 'contacted' as const, handedToSalesAt: null, handedToRelationsAt: null }), true)
    assert.equal(
      roleCanSeeProspect('sales_closer', {
        stage: 'emailed' as const,
        handedToSalesAt: null,
        handedToRelationsAt: null,
        lastContactedAt: '2026-11-07T02:00:00.000Z',
      }),
      true
    )
    const handed = { stage: 'emailed' as const, handedToSalesAt: '2026-11-02T15:00:00.000Z', handedToRelationsAt: null }
    assert.equal(roleCanSeeProspect('lead_procurement', handed), false)
    assert.equal(roleCanSeeProspect('sales_closer', handed), true)
    const won = { stage: 'won' as const, handedToSalesAt: handed.handedToSalesAt, handedToRelationsAt: null }
    assert.equal(roleCanSeeProspect('client_relations', won), false)
    assert.equal(roleCanSeeProspect('sales_closer', won), true)
    assert.equal(roleCanSeeProspect('client_relations', { ...won, handedToRelationsAt: '2026-11-03T15:00:00.000Z' }), true)
  })

  it('keeps each role inside its stages', () => {
    assert.equal(canMoveStage('lead_procurement', 'uncontacted', 'emailed'), true)
    assert.equal(canMoveStage('lead_procurement', 'contacted', 'won'), false)
    assert.equal(canMoveStage('sales_closer', 'offer_made', 'won'), true)
    assert.equal(canMoveStage('sales_closer', 'uncontacted', 'contacted'), true)
    assert.equal(canMoveStage('admin', 'uncontacted', 'won'), true)
    assert.equal(canMoveStage('client_relations', 'won', 'lost_nurture'), false)
  })

  it('splits the admin nav and homes by role', () => {
    assert.deepEqual(
      navForRole('admin').map((item) => item.label),
      ['Today', 'Calendar', 'Pipeline', 'Outreach', 'Clients', 'Credit & Funding', 'Referrals', 'Case Study', 'Todos', 'Sales Kit', 'Training', 'Content Kit', 'Messages', 'Settings']
    )
    // Sales roles see Sales Kit
    assert.deepEqual(navForRole('lead_procurement').map((item) => item.href), [
      '/admin',
      '/admin/calendar',
      '/admin/pipeline',
      '/admin/outreach',
      '/admin/todos',
      '/admin/sales-kit',
      '/admin/training',
      '/admin/messages',
      '/admin/settings',
    ])
    assert.deepEqual(navForRole('sales_closer').map((item) => item.href), [
      '/admin',
      '/admin/calendar',
      '/admin/pipeline',
      '/admin/outreach',
      '/admin/todos',
      '/admin/sales-kit',
      '/admin/training',
      '/admin/messages',
      '/admin/settings',
    ])
    // Client relations sees Content Kit
    assert.deepEqual(navForRole('client_relations').map((item) => item.href), [
      '/admin',
      '/admin/calendar',
      '/admin/pipeline',
      '/admin/clients',
      '/admin/todos',
      '/admin/content-kit',
      '/admin/messages',
      '/admin/settings',
    ])
    assert.deepEqual(navForRole('credit_manager').map((item) => item.href), [
      '/admin/calendar',
      '/admin/credit-funding',
      '/admin/todos',
      '/admin/messages',
      '/admin/settings',
    ])
    assert.equal(navForRole('admin').some((item) => item.href === '/admin/referrals' && item.label === 'Referrals'), true)
    assert.equal(navForRole('admin').some((item) => item.href === '/admin/case-study' && item.label === 'Case Study'), true)
    assert.equal(navForRole('admin').some((item) => item.href === '/admin/partners'), false)
    assert.equal(navForRole('credit_manager').some((item) => item.href === '/admin/referrals'), false)
    assert.equal(navForRole('credit_manager').some((item) => item.href === '/admin/case-study'), false)
    assert.equal(navForRole('lead_procurement').some((item) => item.href === '/admin/referrals'), false)
    assert.equal(navForRole('sales_closer').some((item) => item.href === '/admin/referrals'), false)
    assert.equal(navForRole('client_relations').some((item) => item.href === '/admin/referrals'), false)
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/referrals'), false)
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/case-study'), false)
    assert.equal(marketingRoleAllowedPath('client_relations', '/admin/referrals'), false)
    assert.equal(marketingRoleAllowedPath('lead_procurement', '/admin/messages'), true)
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/messages'), true)
    assert.equal(marketingRoleAllowedPath('client_relations', '/admin/messages'), true)
    assert.equal(homeForRole('credit_manager'), '/admin/credit-funding')
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/outreach'), true)
    assert.equal(marketingRoleAllowedPath('lead_procurement', '/admin/outreach'), true)
    assert.equal(marketingRoleAllowedPath('client_relations', '/admin/outreach'), false)
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/pipeline/abc'), true)
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/credit-funding'), false)
    // Sales roles can access Sales Kit
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/sales-kit'), true)
    assert.equal(marketingRoleAllowedPath('lead_procurement', '/admin/sales-kit'), true)
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/sales-kit/agreement/new'), true)
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/training'), true)
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/training/sop'), true)
    assert.equal(marketingRoleAllowedPath('lead_procurement', '/admin/training'), true)
    assert.equal(marketingRoleAllowedPath('client_relations', '/admin/training'), false)
    // Sales roles cannot access Content Kit
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/content-kit'), false)
    assert.equal(roleMayRunSalesActions('sales_closer'), true)
    assert.equal(roleMayRunSalesActions('admin'), true)
    assert.equal(roleMayRunSalesActions('lead_procurement'), false)
    assert.equal(marketingRoleAllowedPath('client_relations', '/admin/clients'), true)
    assert.equal(marketingRoleAllowedPath('client_relations', '/admin/pipeline'), true)
    assert.equal(marketingRoleAllowedPath('client_relations', '/admin/pipeline/abc'), false)
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/calendar'), true)
    assert.equal(marketingRoleAllowedPath('client_relations', '/admin/calendar'), true)
    assert.equal(roleMayOpenProspectFile('sales_closer'), true)
    assert.equal(roleMayOpenProspectFile('client_relations'), false)
    assert.equal(roleMayOpenProspectFile('credit_manager'), false)
    // Client relations can access Content Kit
    assert.equal(marketingRoleAllowedPath('client_relations', '/admin/content-kit'), true)
    // Client relations cannot access Sales Kit
    assert.equal(marketingRoleAllowedPath('client_relations', '/admin/sales-kit'), false)
    assert.equal(roleMayUsePipeline('client_relations'), true)
    assert.equal(roleMayEditPipeline('client_relations'), false)
    assert.deepEqual(stagesVisibleToRole('client_relations'), [])
    assert.equal(roleCanEditStage('client_relations', 'won'), false)
  })

  it('lets a closer bill only an Active marketing client they can see', () => {
    const won = { stage: 'won' as const, handedToSalesAt: '2026-11-02T15:00:00.000Z', handedToRelationsAt: '2026-11-03T15:00:00.000Z' }
    assert.equal(closerMayBillProspect('sales_closer', won, true), true)
    assert.equal(closerMayBillProspect('sales_closer', { ...won, handedToRelationsAt: null }, true), true)
    assert.equal(closerMayBillProspect('sales_closer', { ...won, stage: 'offer_made' }, true), false)
    assert.equal(closerMayBillProspect('sales_closer', { ...won, stage: 'lost_nurture' }, true), false)
    assert.equal(closerMayBillProspect('sales_closer', won, false), false)
    assert.equal(closerMayBillProspect('lead_procurement', won, true), false)
    assert.equal(closerMayBillProspect('client_relations', won, true), false)
    assert.equal(closerMayBillProspect('admin', won, true), false)
    assert.equal(closerMayBillProspect('sales_closer', null, true), false)
  })

  it('gives each role only the pipeline lanes they own', () => {
    const procurement = boardLanes('lead_procurement')
    assert.equal(procurement.length, 1)
    assert.deepEqual(procurement[0].stages, ['uncontacted', 'emailed'])

    const sales = boardLanes('sales_closer')
    const salesStages = sales.flatMap((lane) => lane.stages)
    assert.equal(sales.length, 3)
    assert.equal(salesStages.includes('uncontacted'), true)
    assert.equal(sales.some((lane) => lane.title === 'Uncontacted'), true)

    const relations = boardLanes('client_relations')
    assert.equal(relations.length, 1)
    assert.deepEqual(relations[0].stages, ['won'])

    const adminStages = boardLanes('admin').flatMap((lane) => lane.stages)
    assert.equal(new Set(adminStages).size, adminStages.length)
    assert.equal(salesStages.includes('emailed'), true)
    assert.equal(salesStages.includes('offer_made'), true)
    assert.deepEqual([...adminStages].sort(), [...STAFF_PIPELINE_STAGES].sort())
    assert.deepEqual(boardLanes(null).flatMap((lane) => lane.stages), adminStages)
    assert.deepEqual(boardLanes('unknown').flatMap((lane) => lane.stages), adminStages)
  })

  it('counts role metrics from pipeline rows', () => {
    const rows = [
      { stage: 'won' as const, hasContact: true, handedToSales: true, estimatedValue: 2500 },
      { stage: 'offer_made' as const, hasContact: true, handedToSales: true, estimatedValue: 0 },
      { stage: 'uncontacted' as const, hasContact: false, handedToSales: false, estimatedValue: 0 },
    ]
    const procurement = procurementMetrics(rows)
    assert.equal(procurement[0].value, '2')
    assert.equal(procurement[2].value, '100%')
    const sales = salesMetrics(rows)
    assert.equal(sales[0].value, '2')
    assert.equal(sales[3].value, '$2,500')
    assert.equal(onboardingComplete({ welcomed: true, assets: true, access: true, requirements: true, expectations: true }), true)
    assert.equal(onboardingComplete({ welcomed: true }), false)
  })

  it('filters and sorts the pipeline list by search, stage, and follow-up', () => {
    const rows = [
      { id: '2', business: 'Zed Cafe', contactName: 'Zed', stage: 'contacted' as const, score: 4, followUpAt: '2026-11-08T14:00:00.000Z' },
      { id: '1', business: 'Bean by Bardea', contactName: 'Bardea', stage: 'uncontacted' as const, score: 9, followUpAt: '2026-11-06T14:00:00.000Z' },
      { id: '3', business: 'Pasteleria', contactName: 'Ana', stage: 'uncontacted' as const, score: 8, followUpAt: '2026-11-06T13:00:00.000Z' },
    ]
    assert.equal(pipelineProspectMatchesQuery(rows[1], 'bardea'), true)
    assert.equal(pipelineProspectMatchesQuery(rows[1], 'pizza'), false)
    const searched = filterPipelineProspects(rows, { query: 'cafe' })
    assert.deepEqual(searched.map((row) => row.id), ['2'])
    const uncontacted = filterPipelineProspects(rows, { stage: 'uncontacted' })
    assert.deepEqual(uncontacted.map((row) => row.business), ['Pasteleria', 'Bean by Bardea'])
    assert.ok(comparePipelineProspects(rows[2], rows[1]) < 0)
    assert.equal(prospectVisibleInBoardStage('sales_closer', { stage: 'won', handedToRelationsAt: '2026-11-03T15:00:00.000Z' }, 'won'), false)
    assert.equal(prospectVisibleInBoardStage('admin', { stage: 'won', handedToRelationsAt: '2026-11-03T15:00:00.000Z' }, 'won'), true)
    assert.equal(prospectVisibleInBoardStage('admin', { stage: 'offer_made' }, 'offer_made'), true)
    assert.equal(prospectVisibleInBoardStage('admin', { stage: 'emailed' }, 'emailed'), true)
    assert.equal(prospectVisibleInBoardStage('admin', { stage: 'emailed' }, 'contacted'), false)
    assert.deepEqual(
      filterPipelineProspects(
        [
          { id: 'r', business: 'Replied Bakery', contactName: 'Rae', stage: 'emailed' as const, score: 8, followUpAt: null },
          { id: 'm', business: 'Meet Cafe', contactName: 'Mo', stage: 'contacted' as const, score: 7, followUpAt: null },
        ],
        { stage: 'contacted' }
      ).map((row) => row.id),
      ['m']
    )
  })

  it('sorts list columns asc/desc and keeps nulls last with search and stage filters', () => {
    const rows = [
      {
        id: 'a',
        business: 'Alpha Grill',
        contactName: 'Ann',
        stage: 'contacted' as const,
        score: 9,
        followUpAt: '2026-11-10T12:00:00.000Z',
        industry: 'Food',
        location: 'Jersey City',
        email: 'ann@alpha.test',
        lastContactedAt: '2026-11-09T12:00:00.000Z',
        source: 'outbound',
        createdAt: '2026-11-01T12:00:00.000Z',
      },
      {
        id: 'b',
        business: 'Beta Salon',
        contactName: '',
        stage: 'uncontacted' as const,
        score: null,
        followUpAt: null,
        industry: null,
        location: 'Newark',
        email: null,
        lastContactedAt: null,
        source: 'in_person',
        createdAt: '2026-11-05T12:00:00.000Z',
      },
      {
        id: 'c',
        business: 'Cedar Cafe',
        contactName: 'Cara',
        stage: 'emailed' as const,
        score: 4,
        followUpAt: '2026-11-08T12:00:00.000Z',
        industry: 'Beauty',
        location: null,
        email: 'cara@cedar.test',
        lastContactedAt: '2026-11-07T12:00:00.000Z',
        source: 'referral',
        createdAt: null,
      },
    ]
    assert.deepEqual(parsePipelineListSort({ sort: 'score', dir: 'desc' }), { key: 'score', dir: 'desc' })
    assert.deepEqual(parsePipelineListSort({ sort: 'nope', dir: 'sideways' }), { key: 'followUp', dir: 'asc' })
    assert.deepEqual(nextPipelineListSort({ key: 'business', dir: 'asc' }, 'business'), {
      key: 'business',
      dir: 'desc',
    })
    assert.deepEqual(nextPipelineListSort({ key: 'business', dir: 'asc' }, 'score'), {
      key: 'score',
      dir: 'desc',
    })

    const byBusiness = filterPipelineProspects(rows, { sortKey: 'business', sortDir: 'asc' })
    assert.deepEqual(byBusiness.map((row) => row.id), ['a', 'b', 'c'])
    const byScoreDesc = filterPipelineProspects(rows, { sortKey: 'score', sortDir: 'desc' })
    assert.deepEqual(byScoreDesc.map((row) => row.id), ['a', 'c', 'b'])
    const byScoreAsc = filterPipelineProspects(rows, { sortKey: 'score', sortDir: 'asc' })
    assert.deepEqual(byScoreAsc.map((row) => row.id), ['c', 'a', 'b'])
    const byEmail = filterPipelineProspects(rows, { sortKey: 'email', sortDir: 'asc' })
    assert.deepEqual(byEmail.map((row) => row.id), ['a', 'c', 'b'])
    const byLocation = filterPipelineProspects(rows, { sortKey: 'location', sortDir: 'asc' })
    assert.deepEqual(byLocation.map((row) => row.id), ['a', 'b', 'c'])
    const byLastContacted = filterPipelineProspects(rows, { sortKey: 'lastContacted', sortDir: 'desc' })
    assert.deepEqual(byLastContacted.map((row) => row.id), ['a', 'c', 'b'])
    assert.ok(comparePipelineProspectsBy(rows[0], rows[1], 'industry', 'asc') < 0)
    assert.deepEqual(parsePipelineListSort({ sort: 'source', dir: 'asc' }), { key: 'followUp', dir: 'asc' })
    assert.deepEqual(parsePipelineListSort({ sort: 'createdAt', dir: 'desc' }), { key: 'followUp', dir: 'desc' })

    const searched = filterPipelineProspects(rows, {
      query: 'jersey',
      sortKey: 'business',
      sortDir: 'asc',
    })
    assert.deepEqual(searched.map((row) => row.id), ['a'])
    const staged = filterPipelineProspects(rows, {
      stage: 'uncontacted',
      sortKey: 'location',
      sortDir: 'asc',
    })
    assert.deepEqual(staged.map((row) => row.id), ['b'])
    assert.equal(pipelineProspectMatchesQuery(rows[0], 'food'), true)
    assert.equal(pipelineProspectMatchesQuery(rows[2], 'cara@cedar'), true)
  })

  it('lists pipeline businesses in a searchable list with a compact board fallback', () => {
    const ui = readFileSync('src/components/admin/MarketingPipeline.tsx', 'utf8')
    const helpers = readFileSync('src/lib/marketing-pipeline.ts', 'utf8')
    assert.match(ui, /Search businesses/)
    assert.match(ui, /All stages/)
    assert.match(ui, /\['list', 'List'\]/)
    assert.match(ui, /\['board', 'Board'\]/)
    assert.match(ui, /sh-pipeline-view/)
    assert.match(ui, /max-h-\[min\(70vh,36rem\)\]/)
    assert.match(ui, /ProspectListRow/)
    assert.match(ui, /SortHeaderButton/)
    assert.match(ui, /LIST_KEYS/)
    assert.match(ui, /LIST_GRID/)
    assert.doesNotMatch(ui, /LIST_PRIMARY_KEYS/)
    assert.doesNotMatch(ui, /LIST_SECONDARY_KEYS/)
    assert.doesNotMatch(ui, /LIST_PRIMARY_GRID/)
    assert.doesNotMatch(ui, /LIST_SECONDARY_GRID/)
    assert.match(ui, /PIPELINE_LIST_SORT_LABELS/)
    assert.match(ui, /writeSortToUrl/)
    assert.match(ui, /Has email/)
    assert.doesNotMatch(ui, /Date added/)
    assert.doesNotMatch(ui, /SecondaryFact/)
    assert.doesNotMatch(ui, /min-w-\[1080px\]/)
    assert.doesNotMatch(ui, /overflow-x-auto">\s*<div className=\{`border-b/)
    assert.match(ui, /md:overflow-x-auto md:pb-2/)
    assert.doesNotMatch(helpers, /Date added/)
    assert.doesNotMatch(helpers, /PIPELINE_LIST_SORT_KEYS = \[[^\]]*source/)
    assert.doesNotMatch(helpers, /PIPELINE_LIST_SORT_KEYS = \[[^\]]*createdAt/)
    assert.doesNotMatch(helpers, /source: 'Source'/)
    assert.doesNotMatch(helpers, /createdAt: 'Date added'/)
    assert.match(helpers, /lastContacted/)
  })
})
