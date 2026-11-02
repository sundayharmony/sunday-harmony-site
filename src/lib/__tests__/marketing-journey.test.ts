import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createProspectProposal,
  handOffProspect,
  listMarketingProspects,
  loadMarketingToday,
  saveMarketingProspect,
  scriptsForProspect,
  sendProspectEmail,
  updateProspectOnboarding,
} from '../marketing-crm'
import { setSupabaseForTests } from '../supabase'

type Row = Record<string, unknown>

class MemoryQuery implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  private filters: Array<(row: Row) => boolean> = []
  private patch: Row | null = null
  private inserted: Row[] | null = null
  private max: number | null = null

  constructor(private table: Row[]) {}

  select() { return this }
  order() { return this }
  limit(count: number) { this.max = count; return this }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value)
    return this
  }

  ilike(column: string, pattern: string) {
    const needle = pattern.replace(/\\%/g, '%').replace(/\\_/g, '_').replace(/\\\\/g, '\\').toLowerCase()
    this.filters.push((row) => String(row[column] ?? '').toLowerCase() === needle)
    return this
  }

  insert(payload: Row | Row[]) {
    const items = Array.isArray(payload) ? payload : [payload]
    this.inserted = items.map((item) => {
      const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...item }
      this.table.push(row)
      return row
    })
    return this
  }

  update(payload: Row) {
    this.patch = payload
    return this
  }

  private matched(): Row[] {
    let found = this.table.filter((row) => this.filters.every((filter) => filter(row)))
    if (this.max != null) found = found.slice(0, this.max)
    return found
  }

  private apply() {
    if (!this.patch) return
    for (const row of this.matched()) Object.assign(row, this.patch)
  }

  private outcome(single: boolean) {
    this.apply()
    if (this.inserted) return { data: single ? this.inserted[0] : this.inserted, error: null }
    const found = this.matched()
    if (single) {
      if (!found[0]) return { data: null, error: { message: 'not found' } }
      return { data: found[0], error: null }
    }
    return { data: found, error: null }
  }

  maybeSingle() {
    this.apply()
    return Promise.resolve({ data: this.matched()[0] || null, error: null })
  }

  single() {
    return Promise.resolve(this.outcome(true))
  }

  then<TResult1 = { data: unknown; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.outcome(false)).then(onfulfilled, onrejected)
  }
}

function memorySupabase() {
  const tables = new Map<string, Row[]>()
  return {
    from(name: string) {
      if (!tables.has(name)) tables.set(name, [])
      return new MemoryQuery(tables.get(name)!)
    },
    rows(name: string) {
      return tables.get(name) || []
    },
  }
}

describe('Lumen & Co. Floral continuity', () => {
  after(() => {
    setSupabaseForTests(null)
  })

  it('walks one sample florist from research to an onboarded marketing client', async () => {
    const db = memorySupabase()
    setSupabaseForTests(db as unknown as SupabaseClient)

    const procurement = { role: 'lead_procurement', email: 'procurement@sundayharmony.com', name: 'Riley Cole' }
    const sales = { role: 'sales_closer', email: 'sales@sundayharmony.com', name: 'Jordan Hale' }
    const relations = { role: 'client_relations', email: 'relations@sundayharmony.com', name: 'Avery Brooks' }
    const followUp = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()

    const created = await saveMarketingProspect(null, {
      business: 'Lumen & Co. Floral',
      source: 'in_person',
      followUpAt: followUp,
      stage: 'researching',
      location: 'Richmond, VA',
      industry: 'Retail florist',
      website: 'https://lumenandco.example',
    }, procurement)
    const id = created.prospect.id
    assert.equal(created.prospect.contactName, '')
    assert.equal(created.prospect.creditApplicationId, null)

    await assert.rejects(
      () => handOffProspect(id, 'sales_closer', procurement),
      /not ready to hand to sales/
    )

    await saveMarketingProspect(id, {
      stage: 'ready_to_contact',
      contactName: 'Maya Ellison',
      opportunity: 'The website has no way to order, and Instagram has been quiet for months.',
      notes: 'Met Maya at the Carytown flower market. Sample continuity business, not a real customer.',
      scoreFactors: { weakness: 2, operating: 2, need: 2, decision_maker: 1, ability: 1 },
      category: 'small',
      recommendedService: 'Social Essentials',
    }, procurement)
    await assert.rejects(
      () => handOffProspect(id, 'sales_closer', procurement),
      /Email or phone/
    )

    const qualified = await saveMarketingProspect(id, {
      email: 'maya@lumenandco.example',
      phone: '804-555-0148',
    }, procurement)
    assert.equal(qualified.prospect.score, 8)
    assert.equal(qualified.prospect.contactName, 'Maya Ellison')

    const scripts = scriptsForProspect(qualified.prospect, procurement)
    assert.match(scripts.find((script) => script.id === 'in_person')?.body || '', /Lumen & Co\. Floral/)

    await assert.rejects(
      () => sendProspectEmail(id, { subject: 'Hello', body: 'Hello Maya' }, procurement),
      /Google Workspace is not connected/
    )

    const handed = await handOffProspect(id, 'sales_closer', procurement)
    assert.equal(handed.stage, 'ready_to_contact')
    assert.ok(handed.handedToSalesAt)
    assert.equal(handed.assignedRole, 'sales_closer')
    assert.equal((await listMarketingProspects('lead_procurement')).some((row) => row.id === id), false)
    assert.equal((await listMarketingProspects('sales_closer')).some((row) => row.id === id), true)
    await assert.rejects(
      () => saveMarketingProspect(id, { notes: 'Changed after the handoff' }, procurement),
      /cannot edit/
    )

    const salesToday = await loadMarketingToday('sales_closer')
    assert.equal(salesToday.handoffs.some((row) => row.business === 'Lumen & Co. Floral'), true)
    assert.equal(salesToday.workspaceConnected, false)

    await saveMarketingProspect(id, { stage: 'contacted' }, sales)
    await saveMarketingProspect(id, { stage: 'responded' }, sales)
    await saveMarketingProspect(id, { stage: 'meeting_scheduled' }, sales)
    await assert.rejects(
      () => createProspectProposal(id, { service: 'Social Essentials', price: '250' }, sales),
      /Google Workspace is not connected/
    )
    await saveMarketingProspect(id, {
      stage: 'proposal_sent',
      proposalDocUrl: 'https://docs.google.com/document/d/lumen-sample',
      estimatedValue: 2400,
    }, sales)
    await assert.rejects(
      () => handOffProspect(id, 'client_relations', sales),
      /Move the prospect to Won/
    )

    await saveMarketingProspect(id, {
      stage: 'won',
      servicesPurchased: 'Social Essentials retainer',
      scope: 'Eight Instagram posts a month and a landing page with an order link.',
      deliverables: 'Content calendar\nLanding page',
      deadline: 'Dec 15, 2026',
      promises: 'Two revision rounds on the landing page.',
      expectations: 'Maya wants a weekly photo plan before the holiday rush.',
      paymentStatus: 'Deposit received',
    }, sales)
    await assert.rejects(
      () => handOffProspect(id, 'client_relations', sales),
      /Agreement marked signed/
    )

    await saveMarketingProspect(id, { agreementSigned: true }, sales)
    const won = await handOffProspect(id, 'client_relations', sales)
    assert.equal(won.stage, 'won')
    assert.ok(won.handedToRelationsAt)
    assert.ok(won.clientId)
    assert.equal(won.creditApplicationId, null)
    assert.equal((await listMarketingProspects('client_relations')).some((row) => row.id === id), true)
    assert.equal((await listMarketingProspects('lead_procurement')).some((row) => row.id === id), false)

    const client = db.rows('clients').find((row) => row.id === won.clientId)
    assert.ok(client)
    assert.equal(client?.business, 'Lumen & Co. Floral')
    assert.equal(client?.email, 'maya@lumenandco.example')
    assert.equal(client?.package_tier, 'social_essentials')
    assert.equal(client?.monthly_price, 250)
    assert.equal(client?.billing_model, 'marketing_subscription')
    assert.equal(client?.lead_id, id)
    assert.match(String(client?.notes), /holiday rush/)

    const logs = db.rows('marketing_handoffs')
    assert.deepEqual(logs.map((row) => row.to_role), ['sales_closer', 'client_relations'])

    const relationsToday = await loadMarketingToday('client_relations')
    assert.equal(relationsToday.handoffs[0]?.business, 'Lumen & Co. Floral')
    assert.equal(relationsToday.handoffs[0]?.href, '/admin/clients')

    const procurementToday = await loadMarketingToday('lead_procurement')
    assert.equal(procurementToday.handoffs.some((row) => row.business === 'Lumen & Co. Floral'), false)
    assert.equal(procurementToday.metrics.find((metric) => metric.label === 'Qualified leads delivered')?.value, '1')
    assert.equal(procurementToday.metrics.find((metric) => metric.label === 'Lead-to-meeting rate')?.value, '100%')

    const salesMetrics = await loadMarketingToday('sales_closer')
    assert.equal(salesMetrics.metrics.find((metric) => metric.label === 'Recorded revenue')?.value, '$2,400')

    await updateProspectOnboarding(id, {
      onboarding: { welcomed: true, assets: true, access: true, requirements: true, expectations: true },
    }, relations)
    const done = await loadMarketingToday('client_relations')
    assert.equal(done.handoffs.length, 0)
    assert.equal(done.metrics.find((metric) => metric.label === 'Onboarding still open')?.value, '0')
  })
})
