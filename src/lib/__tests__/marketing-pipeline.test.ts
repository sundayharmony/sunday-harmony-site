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
  stagesVisibleToRole,
  staffPipelineStage,
  staffStageChoices,
  comparePipelineProspects,
  filterPipelineProspects,
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
    assert.equal(stageFromLegacy({ marketingStatus: 'new_lead', source: 'inbound' }), 'responded')
    assert.equal(stageFromLegacy({ marketingStatus: 'new_lead', source: 'outbound' }), 'researching')
    assert.equal(stageFromLegacy({ marketingStatus: 'consultation_scheduled' }), 'meeting_scheduled')
    assert.equal(stageFromLegacy({ legacyStatus: 'proposal' }), 'proposal_sent')
    assert.equal(stageFromLegacy({ marketingStatus: 'converted' }), 'won')
    assert.equal(marketingStatusForStage('won'), 'converted')
    assert.equal(STAGE_LABELS.won, 'Active')
    assert.equal(STAGE_LABELS.lost_nurture, 'Inactive')
    assert.equal(marketingStatusForStage('responded'), 'contacted')
  })

  it('treats follow-up dates as optional and only set by hand', () => {
    assert.equal(followUpError('researching', ''), null)
    assert.equal(followUpError('researching', null), null)
    assert.equal(followUpError('negotiation', '2026-11-02T15:00:00.000Z'), null)
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
    assert.equal(stageAfterConsultation('responded'), 'meeting_scheduled')
    assert.equal(stageAfterConsultation('proposal_sent'), null)
    assert.equal(stageAfterConsultation('won'), null)
    assert.equal(stageAfterOutboundEmail('ready_to_contact'), 'contacted')
    assert.equal(stageAfterOutboundEmail('responded'), 'responded')
    assert.equal(stageAfterProspectReply('contacted'), 'responded')
    assert.equal(stageAfterProspectReply('proposal_sent'), null)
  })

  it('hides Responded and Meeting scheduled from staff stage choices', () => {
    assert.equal(staffPipelineStage('responded'), 'contacted')
    assert.equal(staffPipelineStage('meeting_scheduled'), 'contacted')
    assert.equal(staffPipelineStage('proposal_sent'), 'proposal_sent')
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
    assert.equal(canHandOffToSales('lead_procurement', 'ready_to_contact'), true)
    assert.equal(canHandOffToSales('sales_closer', 'ready_to_contact'), false)
    assert.equal(canHandOffToSales('lead_procurement', 'researching'), false)
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
    assert.equal(canHandOffToRelations('sales_closer', 'negotiation'), false)
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
    const researching = { stage: 'researching' as const, handedToSalesAt: null, handedToRelationsAt: null }
    assert.equal(roleCanSeeProspect('lead_procurement', researching), true)
    assert.equal(roleCanSeeProspect('sales_closer', researching), false)
    const ready = { stage: 'ready_to_contact' as const, handedToSalesAt: null, handedToRelationsAt: null }
    assert.equal(roleCanSeeProspect('sales_closer', ready), true)
    assert.equal(roleCanSeeProspect('lead_procurement', ready), true)
    assert.equal(roleCanSeeProspect('sales_closer', { stage: 'contacted' as const, handedToSalesAt: null, handedToRelationsAt: null }), false)
    const handed = { stage: 'contacted' as const, handedToSalesAt: '2026-11-02T15:00:00.000Z', handedToRelationsAt: null }
    assert.equal(roleCanSeeProspect('lead_procurement', handed), false)
    assert.equal(roleCanSeeProspect('sales_closer', handed), true)
    const won = { stage: 'won' as const, handedToSalesAt: handed.handedToSalesAt, handedToRelationsAt: null }
    assert.equal(roleCanSeeProspect('client_relations', won), false)
    assert.equal(roleCanSeeProspect('sales_closer', won), true)
    assert.equal(roleCanSeeProspect('client_relations', { ...won, handedToRelationsAt: '2026-11-03T15:00:00.000Z' }), true)
  })

  it('keeps each role inside its stages', () => {
    assert.equal(canMoveStage('lead_procurement', 'researching', 'ready_to_contact'), true)
    assert.equal(canMoveStage('lead_procurement', 'contacted', 'won'), false)
    assert.equal(canMoveStage('sales_closer', 'proposal_sent', 'won'), true)
    assert.equal(canMoveStage('sales_closer', 'researching', 'contacted'), false)
    assert.equal(canMoveStage('admin', 'researching', 'won'), true)
    assert.equal(canMoveStage('client_relations', 'won', 'lost_nurture'), false)
  })

  it('splits the admin nav and homes by role', () => {
    assert.deepEqual(
      navForRole('admin').map((item) => item.label),
      ['Today', 'Calendar', 'Pipeline', 'Outreach', 'Clients', 'Credit & Funding', 'Referrals', 'Todos', 'Sales Kit', 'Training', 'Content Kit', 'Partners', 'Messages', 'Settings']
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
    assert.equal(navForRole('credit_manager').some((item) => item.href === '/admin/referrals'), false)
    assert.equal(navForRole('lead_procurement').some((item) => item.href === '/admin/referrals'), false)
    assert.equal(navForRole('sales_closer').some((item) => item.href === '/admin/referrals'), false)
    assert.equal(navForRole('client_relations').some((item) => item.href === '/admin/referrals'), false)
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/referrals'), false)
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
    assert.equal(closerMayBillProspect('sales_closer', { ...won, stage: 'negotiation' }, true), false)
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
    assert.deepEqual(procurement[0].stages, ['researching', 'ready_to_contact', 'contacted'])

    const sales = boardLanes('sales_closer')
    const salesStages = sales.flatMap((lane) => lane.stages)
    assert.equal(sales.length, 3)
    assert.equal(salesStages.includes('researching'), false)
    assert.equal(sales.some((lane) => lane.title === 'Ready to contact'), true)

    const relations = boardLanes('client_relations')
    assert.equal(relations.length, 1)
    assert.deepEqual(relations[0].stages, ['won'])

    const adminStages = boardLanes('admin').flatMap((lane) => lane.stages)
    assert.equal(new Set(adminStages).size, adminStages.length)
    assert.equal(salesStages.includes('responded'), false)
    assert.equal(salesStages.includes('meeting_scheduled'), false)
    assert.deepEqual([...adminStages].sort(), [...STAFF_PIPELINE_STAGES].sort())
    assert.deepEqual(boardLanes(null).flatMap((lane) => lane.stages), adminStages)
    assert.deepEqual(boardLanes('unknown').flatMap((lane) => lane.stages), adminStages)
  })

  it('counts role metrics from pipeline rows', () => {
    const rows = [
      { stage: 'won' as const, hasContact: true, handedToSales: true, estimatedValue: 2500 },
      { stage: 'meeting_scheduled' as const, hasContact: true, handedToSales: true, estimatedValue: 0 },
      { stage: 'researching' as const, hasContact: false, handedToSales: false, estimatedValue: 0 },
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
      { id: '1', business: 'Bean by Bardea', contactName: 'Bardea', stage: 'researching' as const, score: 9, followUpAt: '2026-11-06T14:00:00.000Z' },
      { id: '3', business: 'Pasteleria', contactName: 'Ana', stage: 'researching' as const, score: 8, followUpAt: '2026-11-06T13:00:00.000Z' },
    ]
    assert.equal(pipelineProspectMatchesQuery(rows[1], 'bardea'), true)
    assert.equal(pipelineProspectMatchesQuery(rows[1], 'pizza'), false)
    const searched = filterPipelineProspects(rows, { query: 'cafe' })
    assert.deepEqual(searched.map((row) => row.id), ['2'])
    const researching = filterPipelineProspects(rows, { stage: 'researching' })
    assert.deepEqual(researching.map((row) => row.business), ['Pasteleria', 'Bean by Bardea'])
    assert.ok(comparePipelineProspects(rows[2], rows[1]) < 0)
    assert.equal(prospectVisibleInBoardStage('sales_closer', { stage: 'won', handedToRelationsAt: '2026-11-03T15:00:00.000Z' }, 'won'), false)
    assert.equal(prospectVisibleInBoardStage('admin', { stage: 'won', handedToRelationsAt: '2026-11-03T15:00:00.000Z' }, 'won'), true)
    assert.equal(prospectVisibleInBoardStage('admin', { stage: 'meeting_scheduled' }, 'contacted'), true)
    assert.equal(prospectVisibleInBoardStage('admin', { stage: 'responded' }, 'contacted'), true)
    assert.equal(prospectVisibleInBoardStage('admin', { stage: 'meeting_scheduled' }, 'meeting_scheduled'), false)
    assert.deepEqual(
      filterPipelineProspects(
        [
          { id: 'r', business: 'Replied Bakery', contactName: 'Rae', stage: 'responded' as const, score: 8, followUpAt: null },
          { id: 'm', business: 'Meet Cafe', contactName: 'Mo', stage: 'meeting_scheduled' as const, score: 7, followUpAt: null },
        ],
        { stage: 'contacted' }
      ).map((row) => row.id),
      ['r', 'm']
    )
  })

  it('lists pipeline businesses in a searchable list with a compact board fallback', () => {
    const ui = readFileSync('src/components/admin/MarketingPipeline.tsx', 'utf8')
    assert.match(ui, /Search businesses/)
    assert.match(ui, /All stages/)
    assert.match(ui, /\['list', 'List'\]/)
    assert.match(ui, /\['board', 'Board'\]/)
    assert.match(ui, /sh-pipeline-view/)
    assert.match(ui, /max-h-\[min\(70vh,36rem\)\]/)
    assert.match(ui, /ProspectListRow/)
  })
})
