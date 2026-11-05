import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { POST } from '../../app/api/internal/leads-import/route'
import { setSupabaseForTests } from '../supabase'

type Row = Record<string, unknown>

const SECRET = 'leads-import-test-secret'

const sampleLeads = [
  {
    business: 'SwingStop Hammonton',
    contactName: 'Christopher Andrews & Matthew Ruga',
    email: 'info@swingstopvineland.com',
    phone: '877-734-9145',
    industry: 'Indoor golf simulator',
    website: 'https://swingstopvineland.com/',
    location: 'Hammonton, NJ',
    category: 'startup',
    opportunity: 'No Hammonton landing page or title mention',
    recommendedService: 'Business Launch $1,799',
    estimatedValue: 1799,
    scoreFactors: {
      weakness: 2,
      operating: 2,
      need: 2,
      decision_maker: 2,
      ability: 2,
    },
    source: 'outbound',
    stage: 'researching',
    followUpAt: '2026-11-06T09:00:00-05:00',
    notes: 'Opener: Chris and Matt, your Hammonton bays opened in August, but the website only talks about Vineland.',
  },
  {
    business: 'Jacobs Plumbing & Heating / Septic (Sal Jacobs)',
    contactName: 'Sal Jacobs',
    email: 'sal@saljacobs.com',
    phone: '(609) 561-7581',
    industry: 'Plumbing, heating & septic',
    website: 'http://www.saljacobs.com/',
    location: 'Hammonton, NJ',
    category: 'established',
    opportunity: 'Title/H1 say septic only, so plumbing and heating searches miss them',
    recommendedService: 'Marketing Partner $799/mo',
    estimatedValue: 9588,
    scoreFactors: {
      weakness: 2,
      operating: 2,
      need: 2,
      decision_maker: 2,
      ability: 2,
    },
    source: 'outbound',
    stage: 'researching',
    followUpAt: '2026-11-06T09:00:00-05:00',
    notes: 'Opener: Sal, Google only sees septic on your site.',
  },
  {
    business: 'Nick & Son Heating & AC',
    contactName: 'Anthony Argiropoulos',
    phone: '(609) 567-5250',
    industry: 'HVAC / refrigeration',
    website: 'http://nickandsonnj.com/',
    location: 'Hammonton, NJ',
    category: 'established',
    opportunity: 'Only 4 reviews in 36 years',
    recommendedService: 'Marketing Partner $799/mo',
    estimatedValue: 9588,
    scoreFactors: {
      weakness: 2,
      operating: 2,
      need: 2,
      decision_maker: 2,
      ability: 2,
    },
    source: 'outbound',
    stage: 'researching',
    followUpAt: '2026-11-06T09:00:00-05:00',
    notes: 'Opener: Anthony, 36 years in Hammonton and only 4 Google reviews.',
  },
] as const

const originalSecret = process.env.LEADS_IMPORT_SECRET

afterEach(() => {
  setSupabaseForTests(null)
  if (originalSecret === undefined) delete process.env.LEADS_IMPORT_SECRET
  else process.env.LEADS_IMPORT_SECRET = originalSecret
})

const MISSING_COLUMN_ERROR = {
  message: "Could not find the 'external_lead_id' column of 'leads' in the schema cache",
  code: 'PGRST204',
}

class MemoryQuery implements PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> {
  private inserted: Row[] | null = null
  private columns = ''
  private writeError: { message: string; code?: string } | null = null
  private patch: Row | null = null
  private filters: Array<(row: Row) => boolean> = []

  constructor(
    private table: Row[],
    private options: { missingExternalIdColumn?: boolean; rejectExternalIdOnInsert?: boolean } = {}
  ) {}

  select(columns = '*') {
    this.columns = columns
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value)
    return this
  }

  update(payload: Row) {
    this.patch = payload
    return this
  }

  insert(payload: Row | Row[]) {
    const items = Array.isArray(payload) ? payload : [payload]
    if (
      (this.options.missingExternalIdColumn || this.options.rejectExternalIdOnInsert) &&
      items.some((item) => Object.prototype.hasOwnProperty.call(item, 'external_lead_id'))
    ) {
      this.writeError = MISSING_COLUMN_ERROR
      return this
    }
    this.inserted = items.map((item) => {
      const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...item }
      this.table.push(row)
      return row
    })
    return this
  }

  then<TResult1 = { data: unknown; error: { message: string; code?: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string; code?: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    if (this.options.missingExternalIdColumn && this.columns.includes('external_lead_id')) {
      return Promise.resolve({ data: null, error: MISSING_COLUMN_ERROR }).then(onfulfilled, onrejected)
    }
    if (this.writeError) {
      return Promise.resolve({ data: null, error: this.writeError }).then(onfulfilled, onrejected)
    }
    if (this.patch) {
      const matched = this.table.filter((row) => this.filters.every((filter) => filter(row)))
      for (const row of matched) Object.assign(row, this.patch)
      return Promise.resolve({ data: matched, error: null }).then(onfulfilled, onrejected)
    }
    const data = this.inserted ?? this.table
    return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected)
  }
}

function memorySupabase(
  seed: Row[] = [],
  options: { missingExternalIdColumn?: boolean; rejectExternalIdOnInsert?: boolean } = {}
) {
  const tables = new Map<string, Row[]>([['leads', [...seed]]])
  return {
    from(name: string) {
      if (!tables.has(name)) tables.set(name, [])
      return new MemoryQuery(tables.get(name)!, options)
    },
    rows(name: string) {
      return tables.get(name) || []
    },
  }
}

function importRequest(body: unknown, secret = SECRET) {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (secret) headers.set('authorization', `Bearer ${secret}`)
  return new NextRequest('https://example.test/api/internal/leads-import', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>
}

describe('POST /api/internal/leads-import', () => {
  it('returns 401 when the import secret is missing', async () => {
    delete process.env.LEADS_IMPORT_SECRET
    const db = memorySupabase()
    setSupabaseForTests(db as unknown as SupabaseClient)

    const response = await POST(importRequest({ leads: sampleLeads }))
    assert.equal(response.status, 401)
    assert.deepEqual(await readJson(response), { error: 'Unauthorized' })
    assert.equal(db.rows('leads').length, 0)
  })

  it('returns 401 when the bearer token is wrong and does not touch the database', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    setSupabaseForTests({
      from() {
        throw new Error('database should not be queried')
      },
    } as unknown as SupabaseClient)

    const response = await POST(importRequest({ leads: sampleLeads }, 'wrong-secret'))
    assert.equal(response.status, 401)
    assert.deepEqual(await readJson(response), { error: 'Unauthorized' })
  })

  it('inserts a new lead and skips one that already exists', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase([
      {
        business: 'SwingStop Hammonton',
        email: 'info@swingstopvineland.com',
        lead_type: 'marketing_lead',
      },
    ])
    setSupabaseForTests(db as unknown as SupabaseClient)

    const response = await POST(importRequest({ leads: [sampleLeads[0], sampleLeads[2]] }))
    const body = await readJson(response)
    assert.equal(response.status, 200)
    assert.equal(body.ok, true)
    assert.equal(body.dryRun, false)
    assert.equal(body.received, 2)
    assert.equal(body.inserted, 1)
    assert.deepEqual(body.skipped, [{ business: 'SwingStop Hammonton', reason: 'Already in the CRM' }])
    assert.equal(body.wouldInsert, undefined)

    const inserted = db.rows('leads').filter((row) => row.business === 'Nick & Son Heating & AC')
    assert.equal(inserted.length, 1)
    assert.equal(inserted[0].email, null)
    assert.equal(inserted[0].first_name, 'Anthony')
    assert.equal(inserted[0].last_name, 'Argiropoulos')
    assert.equal(inserted[0].location_text, 'Hammonton, NJ')
    assert.equal(inserted[0].prospect_category, 'established')
    assert.equal(inserted[0].lead_type, 'marketing_lead')
    assert.equal(inserted[0].assigned_role, 'lead_procurement')
    assert.equal(inserted[0].pipeline_stage, 'researching')
    assert.equal(inserted[0].marketing_lead_status, 'new_lead')
    assert.equal(inserted[0].status, 'new')
    assert.equal(inserted[0].prospect_score, 10)
    assert.equal(inserted[0].recommended_service, inserted[0].service)
  })

  it('imports a lead without a follow-up date', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase()
    setSupabaseForTests(db as unknown as SupabaseClient)
    const { followUpAt: _followUpAt, ...lead } = sampleLeads[2]

    const response = await POST(importRequest({ leads: [lead] }))
    const body = await readJson(response)
    assert.equal(response.status, 200)
    assert.equal(body.inserted, 1)
    const inserted = db.rows('leads').find((row) => row.business === 'Nick & Son Heating & AC')
    assert.equal(inserted?.follow_up_at, null)
  })

  it('skips in-batch duplicates after inserting the first copy', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase()
    setSupabaseForTests(db as unknown as SupabaseClient)

    const response = await POST(importRequest({
      leads: [sampleLeads[0], { ...sampleLeads[0], notes: 'Repeated row' }],
    }))
    const body = await readJson(response)
    assert.equal(body.inserted, 1)
    assert.deepEqual(body.skipped, [{ business: 'SwingStop Hammonton', reason: 'Duplicate in this batch' }])
    assert.equal(db.rows('leads').filter((row) => row.business === 'SwingStop Hammonton').length, 1)
  })

  it('skips invalid category or stage rows and still imports valid ones', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase()
    setSupabaseForTests(db as unknown as SupabaseClient)

    const response = await POST(importRequest({
      leads: [
        { ...sampleLeads[0], category: 'enterprise' },
        { ...sampleLeads[1], stage: 'awaiting_reply' },
        sampleLeads[2],
      ],
    }))
    const body = await readJson(response)
    assert.equal(body.received, 3)
    assert.equal(body.inserted, 1)
    assert.deepEqual(body.skipped, [
      {
        business: 'SwingStop Hammonton',
        reason: 'Prospect category must be established, small, or startup',
      },
      { business: 'Jacobs Plumbing & Heating / Septic (Sal Jacobs)', reason: 'Invalid pipeline stage' },
    ])
    assert.equal(db.rows('leads').length, 1)
    assert.equal(db.rows('leads')[0].business, 'Nick & Son Heating & AC')
  })

  it('validates and dedupes on dryRun without inserting', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase([
      {
        business: 'SwingStop, Hammonton',
        email: 'other@example.com',
        lead_type: 'marketing_lead',
      },
    ])
    setSupabaseForTests(db as unknown as SupabaseClient)

    const response = await POST(importRequest({
      dryRun: true,
      leads: [sampleLeads[0], sampleLeads[1], sampleLeads[1]],
    }))
    const body = await readJson(response)
    assert.equal(response.status, 200)
    assert.equal(body.ok, true)
    assert.equal(body.dryRun, true)
    assert.equal(body.received, 3)
    assert.equal(body.inserted, 0)
    assert.equal(body.wouldInsert, 1)
    assert.deepEqual(body.skipped, [
      { business: 'SwingStop Hammonton', reason: 'Already in the CRM' },
      { business: 'Jacobs Plumbing & Heating / Septic (Sal Jacobs)', reason: 'Duplicate in this batch' },
    ])
    assert.equal(db.rows('leads').length, 1)
    assert.equal(db.rows('activity_log').length, 0)
  })

  it('defaults source to outbound and stage to researching', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase()
    setSupabaseForTests(db as unknown as SupabaseClient)

    const { source: _source, stage: _stage, ...withoutDefaults } = sampleLeads[1]
    const response = await POST(importRequest({ leads: [withoutDefaults] }))
    const body = await readJson(response)
    assert.equal(body.inserted, 1)
    assert.deepEqual(body.skipped, [])
    const row = db.rows('leads')[0]
    assert.equal(row.source, 'outbound')
    assert.equal(row.pipeline_stage, 'researching')
    assert.equal(row.marketing_lead_status, 'new_lead')
    assert.equal(row.status, 'new')
    assert.equal(row.first_name, 'Sal')
    assert.equal(row.last_name, 'Jacobs')
    assert.equal(row.estimated_value, 9588)
  })

  it('skips a lead whose externalId is already in the CRM', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase([
      {
        business: 'Old SwingStop Name',
        email: 'old@example.com',
        lead_type: 'marketing_lead',
        external_lead_id: 'SH-0001',
      },
    ])
    setSupabaseForTests(db as unknown as SupabaseClient)

    const response = await POST(importRequest({
      leads: [{ ...sampleLeads[0], externalId: 'SH-0001' }, { ...sampleLeads[2], externalId: 'SH-0003' }],
    }))
    const body = await readJson(response)
    assert.equal(body.inserted, 1)
    assert.deepEqual(body.skipped, [
      { business: 'SwingStop Hammonton', reason: 'already imported (Lead ID)' },
    ])
    assert.equal(db.rows('leads').some((row) => row.business === 'SwingStop Hammonton'), false)
    assert.equal(db.rows('leads').find((row) => row.business === 'Nick & Son Heating & AC')?.external_lead_id, 'SH-0003')
  })

  it('skips a new externalId when the business name already exists', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase([
      {
        business: 'SwingStop Hammonton',
        email: 'info@swingstopvineland.com',
        lead_type: 'marketing_lead',
      },
    ])
    setSupabaseForTests(db as unknown as SupabaseClient)

    const response = await POST(importRequest({
      leads: [{ ...sampleLeads[0], externalId: 'SH-0001' }],
    }))
    const body = await readJson(response)
    assert.equal(body.inserted, 0)
    assert.deepEqual(body.skipped, [
      { business: 'SwingStop Hammonton', reason: 'Already in the CRM' },
    ])
    assert.equal(db.rows('leads').length, 1)
    assert.equal(db.rows('leads')[0].external_lead_id, undefined)
  })

  it('skips a repeated externalId in the same payload', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase()
    setSupabaseForTests(db as unknown as SupabaseClient)

    const response = await POST(importRequest({
      leads: [
        { ...sampleLeads[0], externalId: 'SH-0001' },
        { ...sampleLeads[1], externalId: 'SH-0001' },
      ],
    }))
    const body = await readJson(response)
    assert.equal(body.inserted, 1)
    assert.deepEqual(body.skipped, [
      { business: 'Jacobs Plumbing & Heating / Septic (Sal Jacobs)', reason: 'Duplicate in this batch' },
    ])
    assert.equal(db.rows('leads')[0].external_lead_id, 'SH-0001')
    assert.equal(db.rows('leads')[0].business, 'SwingStop Hammonton')
  })

  it('falls back to name and email when external_lead_id is not in the database yet', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase(
      [
        {
          business: 'SwingStop Hammonton',
          email: 'info@swingstopvineland.com',
          lead_type: 'marketing_lead',
        },
      ],
      { missingExternalIdColumn: true }
    )
    setSupabaseForTests(db as unknown as SupabaseClient)

    const response = await POST(importRequest({
      leads: [
        { ...sampleLeads[0], externalId: 'SH-0001' },
        { ...sampleLeads[2], externalId: 'SH-0003' },
      ],
    }))
    const body = await readJson(response)
    assert.equal(response.status, 200)
    assert.equal(body.inserted, 1)
    assert.equal(body.warning, 'external_lead_id is missing. Run supabase-migration-052-lead-external-id.sql in the Supabase SQL Editor.')
    assert.deepEqual(body.skipped, [
      { business: 'SwingStop Hammonton', reason: 'Already in the CRM' },
    ])
    const inserted = db.rows('leads').find((row) => row.business === 'Nick & Son Heating & AC')
    assert.equal(inserted?.external_lead_id, undefined)
  })

  it('retries the insert without external_lead_id instead of failing the batch', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase([], { rejectExternalIdOnInsert: true })
    setSupabaseForTests(db as unknown as SupabaseClient)

    const response = await POST(importRequest({
      leads: [{ ...sampleLeads[2], externalId: 'SH-0003' }],
    }))
    const body = await readJson(response)
    assert.equal(response.status, 200)
    assert.equal(body.inserted, 1)
    assert.equal(body.warning, 'external_lead_id is missing. Run supabase-migration-052-lead-external-id.sql in the Supabase SQL Editor.')
    assert.equal(db.rows('leads')[0].business, 'Nick & Son Heating & AC')
    assert.equal(db.rows('leads')[0].external_lead_id, undefined)
  })

  it('backfills a Lead ID by matching the normalized business name', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase([
      {
        id: 'lead-swingstop',
        business: 'SwingStop, Hammonton',
        email: 'info@swingstopvineland.com',
        first_name: 'Existing',
        notes: 'keep these notes',
        lead_type: 'marketing_lead',
        external_lead_id: null,
      },
    ])
    setSupabaseForTests(db as unknown as SupabaseClient)

    const response = await POST(importRequest({
      backfillIds: true,
      leads: [{ ...sampleLeads[0], externalId: 'SH-0001' }],
    }))
    const body = await readJson(response)
    assert.equal(response.status, 200)
    assert.equal(body.ok, true)
    assert.equal(body.backfillIds, true)
    assert.equal(body.matched, 1)
    assert.equal(body.updated, 1)
    assert.deepEqual(body.unmatched, [])
    assert.deepEqual(body.conflicts, [])
    assert.equal(body.inserted, undefined)
    const row = db.rows('leads')[0]
    assert.equal(row.external_lead_id, 'SH-0001')
    assert.equal(row.first_name, 'Existing')
    assert.equal(row.notes, 'keep these notes')
    assert.equal(db.rows('leads').length, 1)
  })

  it('backfills a Lead ID by falling back to email when the business name does not match', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase([
      {
        id: 'lead-email',
        business: 'Different Name LLC',
        email: 'info@swingstopvineland.com',
        notes: 'keep me',
        lead_type: 'marketing_lead',
        external_lead_id: '',
      },
    ])
    setSupabaseForTests(db as unknown as SupabaseClient)

    const response = await POST(importRequest({
      backfillIds: true,
      leads: [{ ...sampleLeads[0], externalId: 'SH-0001' }],
    }))
    const body = await readJson(response)
    assert.equal(body.matched, 1)
    assert.equal(body.updated, 1)
    assert.deepEqual(body.unmatched, [])
    assert.equal(db.rows('leads')[0].external_lead_id, 'SH-0001')
    assert.equal(db.rows('leads')[0].business, 'Different Name LLC')
    assert.equal(db.rows('leads')[0].notes, 'keep me')
  })

  it('does not overwrite an existing non-empty Lead ID', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase([
      {
        id: 'lead-conflict',
        business: 'SwingStop Hammonton',
        email: 'info@swingstopvineland.com',
        notes: 'original',
        lead_type: 'marketing_lead',
        external_lead_id: 'SH-9999',
      },
    ])
    setSupabaseForTests(db as unknown as SupabaseClient)

    const response = await POST(importRequest({
      backfillIds: true,
      leads: [{ ...sampleLeads[0], externalId: 'SH-0001' }],
    }))
    const body = await readJson(response)
    assert.equal(body.matched, 1)
    assert.equal(body.updated, 0)
    assert.deepEqual(body.conflicts, [
      { business: 'SwingStop Hammonton', existingId: 'SH-9999', incomingId: 'SH-0001' },
    ])
    assert.equal(db.rows('leads')[0].external_lead_id, 'SH-9999')
    assert.equal(db.rows('leads')[0].notes, 'original')
  })

  it('reports unmatched payload leads that are not in the CRM', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase([
      {
        id: 'lead-nick',
        business: 'Nick & Son Heating & AC',
        email: null,
        lead_type: 'marketing_lead',
        external_lead_id: null,
      },
    ])
    setSupabaseForTests(db as unknown as SupabaseClient)

    const response = await POST(importRequest({
      backfillIds: true,
      leads: [
        { ...sampleLeads[2], externalId: 'SH-0003' },
        { ...sampleLeads[1], externalId: 'SH-0002' },
      ],
    }))
    const body = await readJson(response)
    assert.equal(body.matched, 1)
    assert.equal(body.updated, 1)
    assert.deepEqual(body.unmatched, [
      { business: 'Jacobs Plumbing & Heating / Septic (Sal Jacobs)' },
    ])
    assert.equal(db.rows('leads').length, 1)
    assert.equal(db.rows('leads')[0].external_lead_id, 'SH-0003')
  })

  it('dry-runs a Lead ID backfill without writing', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase([
      {
        id: 'lead-swingstop',
        business: 'SwingStop Hammonton',
        email: 'info@swingstopvineland.com',
        notes: 'untouched',
        lead_type: 'marketing_lead',
        external_lead_id: null,
      },
    ])
    setSupabaseForTests(db as unknown as SupabaseClient)

    const response = await POST(importRequest({
      backfillIds: true,
      dryRun: true,
      leads: [{ ...sampleLeads[0], externalId: 'SH-0001' }],
    }))
    const body = await readJson(response)
    assert.equal(body.ok, true)
    assert.equal(body.backfillIds, true)
    assert.equal(body.dryRun, true)
    assert.equal(body.matched, 1)
    assert.equal(body.updated, 1)
    assert.deepEqual(body.unmatched, [])
    assert.deepEqual(body.conflicts, [])
    assert.equal(db.rows('leads')[0].external_lead_id, null)
    assert.equal(db.rows('leads')[0].notes, 'untouched')
    assert.equal(db.rows('activity_log').length, 0)
  })

  it('skips backfill and warns when the Lead ID column is not in the database yet', async () => {
    process.env.LEADS_IMPORT_SECRET = SECRET
    const db = memorySupabase(
      [
        {
          id: 'lead-swingstop',
          business: 'SwingStop Hammonton',
          email: 'info@swingstopvineland.com',
          lead_type: 'marketing_lead',
        },
      ],
      { missingExternalIdColumn: true }
    )
    setSupabaseForTests(db as unknown as SupabaseClient)

    const response = await POST(importRequest({
      backfillIds: true,
      leads: [{ ...sampleLeads[0], externalId: 'SH-0001' }],
    }))
    const body = await readJson(response)
    assert.equal(response.status, 200)
    assert.equal(body.backfillIds, true)
    assert.equal(body.matched, 0)
    assert.equal(body.updated, 0)
    assert.equal(body.warning, 'external_lead_id is missing. Run supabase-migration-052-lead-external-id.sql in the Supabase SQL Editor.')
    assert.equal(db.rows('leads')[0].external_lead_id, undefined)
  })
})
