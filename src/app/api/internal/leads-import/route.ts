import { NextRequest, NextResponse } from 'next/server'
import { logActivity } from '@/lib/db'
import {
  followUpError,
  isLeadSource,
  isPipelineStage,
  isProspectCategory,
  legacyLeadStatusForStage,
  marketingStatusForStage,
  normalizeScoreFactors,
  scoreTotal,
  type PipelineStage,
} from '@/lib/marketing-pipeline'
import { getSupabase } from '@/lib/supabase'
import { timingSafeStringEqual } from '@/lib/timing-safe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const INSERT_BATCH_SIZE = 50

type SkippedLead = { business: string; reason: string }

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function splitContact(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/)
  return { first: parts[0] || '', last: parts.slice(1).join(' ') }
}

function normalizeBusinessName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,'&/()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isMarketingLeadType(value: unknown): boolean {
  const type = typeof value === 'string' && value.trim() ? value.trim() : 'marketing_lead'
  return type === 'marketing_lead' || type === 'existing_client' || type === 'completed_client'
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.LEADS_IMPORT_SECRET?.trim()
  if (!secret) return false
  return timingSafeStringEqual(request.headers.get('authorization'), `Bearer ${secret}`)
}

async function loadExistingKeys(): Promise<{ businesses: Set<string>; emails: Set<string> }> {
  const { data, error } = await getSupabase().from('leads').select('business, email, lead_type')
  if (error) {
    throw new Error(error.message || 'Could not load existing leads')
  }

  const businesses = new Set<string>()
  const emails = new Set<string>()
  for (const row of (data || []) as Array<Record<string, unknown>>) {
    if (!isMarketingLeadType(row.lead_type)) continue
    const business = normalizeBusinessName(typeof row.business === 'string' ? row.business : '')
    if (business) businesses.add(business)
    const email = clean(row.email).toLowerCase()
    if (email) emails.add(email)
  }
  return { businesses, emails }
}

function mapLeadRow(lead: Record<string, unknown>, now: string): Record<string, unknown> {
  const business = clean(lead.business)
  const contact = splitContact(clean(lead.contactName))
  const source = clean(lead.source) || 'outbound'
  const stage = (clean(lead.stage) || 'researching') as PipelineStage
  const category = clean(lead.category)
  const factors = lead.scoreFactors === undefined ? undefined : normalizeScoreFactors(lead.scoreFactors)
  const recommended = clean(lead.recommendedService)
  const followUpAt = clean(lead.followUpAt) || null
  const estimated =
    lead.estimatedValue === undefined || lead.estimatedValue === null || lead.estimatedValue === ''
      ? null
      : Number(lead.estimatedValue)

  return {
    first_name: contact.first,
    last_name: contact.last,
    email: clean(lead.email) || null,
    phone: clean(lead.phone) || null,
    business,
    industry: clean(lead.industry) || null,
    website: clean(lead.website) || null,
    location_text: clean(lead.location) || null,
    prospect_category: category || null,
    marketing_opportunity: clean(lead.opportunity),
    recommended_service: recommended,
    service: recommended,
    score_factors: factors || {},
    prospect_score: factors ? scoreTotal(factors) : null,
    source,
    follow_up_at: followUpAt,
    pipeline_stage: stage,
    marketing_lead_status: marketingStatusForStage(stage),
    status: legacyLeadStatusForStage(stage),
    estimated_value: Number.isFinite(estimated as number) ? estimated : null,
    notes: clean(lead.notes),
    lead_type: 'marketing_lead',
    assigned_role: 'lead_procurement',
    created_at: now,
    updated_at: now,
  }
}

function validateLead(lead: unknown):
  | SkippedLead
  | { ok: true; record: Record<string, unknown>; businessKey: string; emailKey: string } {
  if (!lead || typeof lead !== 'object' || Array.isArray(lead)) {
    return { business: '', reason: 'Lead must be an object' }
  }
  const input = lead as Record<string, unknown>
  const business = clean(input.business)
  if (!business) {
    return { business, reason: 'Business name is required' }
  }
  const source = clean(input.source) || 'outbound'
  if (!isLeadSource(source)) {
    return { business, reason: 'Choose a lead source' }
  }
  const category = clean(input.category)
  if (category && !isProspectCategory(category)) {
    return { business, reason: 'Prospect category must be established, small, or startup' }
  }
  const stageRaw = clean(input.stage)
  if (stageRaw && !isPipelineStage(stageRaw)) {
    return { business, reason: 'Invalid pipeline stage' }
  }
  const stage = (stageRaw || 'researching') as PipelineStage
  const followUpAt = clean(input.followUpAt) || null
  const followUpProblem = followUpError(stage, followUpAt)
  if (followUpProblem) {
    return { business, reason: followUpProblem }
  }
  return {
    ok: true,
    record: input,
    businessKey: normalizeBusinessName(business),
    emailKey: clean(input.email).toLowerCase(),
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Expected a JSON object' }, { status: 400 })
    }

    const payload = body as { dryRun?: unknown; leads?: unknown }
    if (!Array.isArray(payload.leads)) {
      return NextResponse.json({ error: 'Expected a leads array' }, { status: 400 })
    }

    const dryRun = payload.dryRun === true
    const existing = await loadExistingKeys()
    const seenBusinesses = new Set(existing.businesses)
    const seenEmails = new Set(existing.emails)
    const skipped: SkippedLead[] = []
    const toInsert: Record<string, unknown>[] = []
    const now = new Date().toISOString()

    for (const lead of payload.leads) {
      const result = validateLead(lead)
      if (!('ok' in result)) {
        skipped.push(result)
        continue
      }

      const matchesExisting =
        existing.businesses.has(result.businessKey) ||
        (Boolean(result.emailKey) && existing.emails.has(result.emailKey))
      const matchesBatch =
        seenBusinesses.has(result.businessKey) ||
        (Boolean(result.emailKey) && seenEmails.has(result.emailKey))
      if (matchesExisting || matchesBatch) {
        skipped.push({
          business: clean(result.record.business),
          reason: matchesExisting ? 'Already in the CRM' : 'Duplicate in this batch',
        })
        continue
      }

      seenBusinesses.add(result.businessKey)
      if (result.emailKey) seenEmails.add(result.emailKey)
      toInsert.push(mapLeadRow(result.record, now))
    }

    if (!dryRun && toInsert.length > 0) {
      for (let index = 0; index < toInsert.length; index += INSERT_BATCH_SIZE) {
        const chunk = toInsert.slice(index, index + INSERT_BATCH_SIZE)
        const { error } = await getSupabase().from('leads').insert(chunk)
        if (error) {
          throw new Error(error.message || 'Could not insert leads')
        }
      }
      await logActivity({
        action: 'lead_created',
        entity_type: 'lead',
        actor_email: 'leads-import',
        details: `Imported ${toInsert.length} marketing prospects`,
      })
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      received: payload.leads.length,
      inserted: dryRun ? 0 : toInsert.length,
      skipped,
      ...(dryRun ? { wouldInsert: toInsert.length } : {}),
    })
  } catch (error) {
    console.error('Leads import failed:', error)
    return NextResponse.json({ error: 'Leads import failed' }, { status: 500 })
  }
}
