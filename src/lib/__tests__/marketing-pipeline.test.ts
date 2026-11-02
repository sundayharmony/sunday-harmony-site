import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { roleMayEditPipeline, roleMayUsePipeline } from '../marketing-crm'
import {
  boardLanes,
  canHandOffToRelations,
  canHandOffToSales,
  closerMayBillProspect,
  canMoveStage,
  roleCanEditStage,
  roleCanSeeProspect,
  followUpError,
  homeForRole,
  marketingRoleAllowedPath,
  marketingStatusForStage,
  navForRole,
  onboardingComplete,
  PIPELINE_STAGES,
  procurementHandoffGaps,
  procurementMetrics,
  salesHandoffGaps,
  salesMetrics,
  scoreBand,
  scoreTotal,
  stageAfterConsultation,
  stageAfterOutboundEmail,
  stageAfterProspectReply,
  STAGE_LABELS,
  stageFromLegacy,
  stagesVisibleToRole,
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

  it('requires a follow-up date until the prospect is won or lost', () => {
    assert.match(followUpError('researching', '') || '', /follow-up/)
    assert.equal(followUpError('negotiation', '2026-11-02T15:00:00.000Z'), null)
    assert.equal(followUpError('won', null), null)
    assert.equal(followUpError('lost_nurture', null), null)
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
    })
    assert.deepEqual(gaps, ['Agreement marked signed'])
  })

  it('moves a lead out of procurement after the sales handoff and into client relations only after the won handoff', () => {
    const researching = { stage: 'researching' as const, handedToSalesAt: null, handedToRelationsAt: null }
    assert.equal(roleCanSeeProspect('lead_procurement', researching), true)
    assert.equal(roleCanSeeProspect('sales_closer', researching), false)
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
      ['Today', 'Pipeline', 'Clients', 'Credit & Funding', 'Partners', 'Settings']
    )
    assert.deepEqual(navForRole('lead_procurement').map((item) => item.href), [
      '/admin',
      '/admin/pipeline',
      '/admin/settings',
    ])
    assert.deepEqual(navForRole('client_relations').map((item) => item.href), [
      '/admin',
      '/admin/pipeline',
      '/admin/clients',
      '/admin/settings',
    ])
    assert.deepEqual(navForRole('credit_manager').map((item) => item.href), [
      '/admin/credit-funding',
      '/admin/settings',
    ])
    assert.equal(homeForRole('credit_manager'), '/admin/credit-funding')
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/pipeline/abc'), true)
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/credit-funding'), false)
    assert.equal(marketingRoleAllowedPath('client_relations', '/admin/clients'), true)
    assert.equal(marketingRoleAllowedPath('client_relations', '/admin/pipeline'), true)
    assert.equal(marketingRoleAllowedPath('client_relations', '/admin/pipeline/abc'), false)
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
    assert.equal(sales.some((lane) => lane.title === 'Handed to sales'), true)

    const relations = boardLanes('client_relations')
    assert.equal(relations.length, 1)
    assert.deepEqual(relations[0].stages, ['won'])

    const adminStages = boardLanes('admin').flatMap((lane) => lane.stages)
    assert.equal(new Set(adminStages).size, adminStages.length)
    assert.deepEqual([...adminStages].sort(), [...PIPELINE_STAGES].sort())
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
})
