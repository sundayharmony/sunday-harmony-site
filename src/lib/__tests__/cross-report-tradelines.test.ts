import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  accountMatchKey,
  creditorQuality,
  enrichTradelinesAcrossReports,
} from '../dispute-letters/cross-report-tradelines'
import type { DisputeSessionListItem, Tradeline } from '../dispute-letters/types'

function tl(partial: Partial<Tradeline> & Pick<Tradeline, 'id' | 'creditor'>): Tradeline {
  return {
    account_tu: '',
    account_exp: '',
    account_eqf: '',
    account_type: 'Credit Card',
    status: 'Open',
    balance: '$0.00',
    past_due: '',
    remarks: '',
    bureaus: [],
    is_collection: false,
    selected: false,
    dispute_reason: '',
    analysis_notes: '',
    suggested_dispute_reason: '',
    dispute_bureaus: [],
    dispute_furnisher: true,
    legal_flags: [],
    repair_priority: 'medium',
    item_category: 'late_payment',
    ...partial,
  }
}

function session(
  id: string,
  tradelines: Tradeline[],
  status: DisputeSessionListItem['status'] = 'ready'
): DisputeSessionListItem {
  return {
    id,
    admin_user_id: 'test-admin',
    status,
    storage_path: `${id}.pdf`,
    file_name: `${id}.pdf`,
    file_type: 'pdf',
    error_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    report_json: {
      source: 'fallback_parser',
      reference: '',
      report_date: '',
      analysis_summary: '',
      credit_health: {
        scores: { tuc: null, exp: null, eqf: null },
        total_accounts: tradelines.length,
        negative_count: 0,
        collection_count: 0,
        high_priority_count: 0,
        repair_summary: '',
        recommended_actions: [],
      },
      consumer: { name: '', dob: '', ssn_last4: '', addresses: [] },
      tradelines,
      subscribers: [],
      file_type: 'pdf',
      ocr_used: false,
      extraction_quality: 'medium',
    },
  }
}

describe('cross-report tradeline enrichment', () => {
  it('matches masked account numbers across bureaus', () => {
    assert.equal(
      accountMatchKey(tl({ id: '1', creditor: 'A', account_tu: '601100XXXXXX' })),
      accountMatchKey(tl({ id: '2', creditor: 'B', account_eqf: '601100XXXXXX' }))
    )
  })

  it('prefers fuller creditor names and unions bureau tags', () => {
    assert.ok(creditorQuality('DISCOVERCARD') > creditorQuality('DISCOVER C'))
    assert.ok(creditorQuality('CAPITAL ONE') > creditorQuality('CAP ONE'))
    assert.equal(creditorQuality('Unnamed · Credit Card 601100XXXXXX'), 0)

    const eqf = [
      tl({
        id: 'eqf-discover',
        creditor: 'Unnamed · Credit Card 601100XXXXXX',
        account_eqf: '601100XXXXXX',
        bureaus: ['EQF'],
        dispute_bureaus: ['EQF'],
        balance: '$306.00',
        past_due: '$70.00',
      }),
      tl({
        id: 'eqf-cap',
        creditor: 'CAP ONE',
        account_eqf: '517805XXXXXX',
        bureaus: ['EQF'],
        dispute_bureaus: ['EQF'],
      }),
    ]
    const siblings = [
      session('tu', [
        tl({
          id: 'tu-discover',
          creditor: 'DISCOVERCARD',
          account_tu: '601100XXXXXX',
          bureaus: ['TUC'],
          dispute_bureaus: ['TUC'],
        }),
        tl({
          id: 'tu-cap',
          creditor: 'CAPITAL ONE',
          account_tu: '517805XXXXXX',
          bureaus: ['TUC'],
          dispute_bureaus: ['TUC'],
        }),
      ]),
      session('exp', [
        tl({
          id: 'exp-discover',
          creditor: 'DISCOVERC',
          account_exp: '601100XXXXXX',
          bureaus: ['EXP'],
          dispute_bureaus: ['EXP'],
        }),
      ]),
    ]

    const enriched = enrichTradelinesAcrossReports(eqf, siblings, 'eqf-session')
    const discover = enriched.find((t) => t.id === 'eqf-discover')
    const cap = enriched.find((t) => t.id === 'eqf-cap')
    assert.equal(discover?.creditor, 'DISCOVERCARD')
    assert.deepEqual(discover?.bureaus, ['TUC', 'EXP', 'EQF'])
    assert.equal(cap?.creditor, 'CAPITAL ONE')
    assert.deepEqual(cap?.bureaus, ['TUC', 'EQF'])
  })
})
