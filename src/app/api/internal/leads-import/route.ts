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
const MISSING_COLUMN_WARNING =
  'external_lead_id is missing. Run supabase-migration-052-lead-external-id.sql in the Supabase SQL Editor.'

type SkippedLead = { business: string; reason: string }

type ExistingKeys = {
  businesses: Set<string>
  emails: Set<string>
  externalIds: Set<string>
  columnAvailable: boolean
  warning?: string
}

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

function isUnknownExternalLeadIdColumn(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false
  const code = String(error.code || '')
  if (code === '42703' || code === 'PGRST204') return true
  const message = String(error.message || '').toLowerCase()
  if (!message.includes('external_lead_id')) return false
  return (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    (message.includes('could not find') && message.includes('column'))
  )
}

function collectKeys(rows: Array<Record<string, unknown>>, columnAvailable: boolean): ExistingKeys {
  const businesses = new Set<string>()
  const emails = new Set<string>()
  const externalIds = new Set<string>()
  for (const row of rows) {
    const externalId = clean(row.external_lead_id)
    if (externalId) externalIds.add(externalId)
    if (!isMarketingLeadType(row.lead_type)) continue
    const business = normalizeBusinessName(typeof row.business === 'string' ? row.business : '')
    if (business) businesses.add(business)
    const email = clean(row.email).toLowerCase()
    if (email) emails.add(email)
  }
  return { businesses, emails, externalIds, columnAvailable }
}

async function loadExistingKeys(): Promise<ExistingKeys> {
  const withColumn = await getSupabase()
    .from('leads')
    .select('business, email, lead_type, external_lead_id')
  if (!withColumn.error) {
    return collectKeys((withColumn.data || []) as Array<Record<string, unknown>>, true)
  }
  if (isUnknownExternalLeadIdColumn(withColumn.error)) {
    const fallback = await getSupabase().from('leads').select('business, email, lead_type')
    if (fallback.error) {
      throw new Error(fallback.error.message || 'Could not load existing leads')
    }
    return {
      ...collectKeys((fallback.data || []) as Array<Record<string, unknown>>, false),
      warning: MISSING_COLUMN_WARNING,
    }
  }
  throw new Error(withColumn.error.message || 'Could not load existing leads')
}

function mapLeadRow(
  lead: Record<string, unknown>,
  now: string,
  includeExternalId: boolean
): Record<string, unknown> {
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

  const row: Record<string, unknown> = {
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
  if (includeExternalId) {
    row.external_lead_id = clean(lead.externalId) || null
  }
  return row
}

function stripExternalLeadId(row: Record<string, unknown>): Record<string, unknown> {
  const { external_lead_id: _externalLeadId, ...rest } = row
  return rest
}

function validateLead(lead: unknown):
  | SkippedLead
  | { ok: true; record: Record<string, unknown>; businessKey: string; emailKey: string; externalId: string } {
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
    externalId: clean(input.externalId),
  }
}

async function insertChunks(
  rows: Record<string, unknown>[],
  columnAvailable: boolean
): Promise<{ inserted: number; warning?: string }> {
  let warning: string | undefined
  let includeExternalId = columnAvailable
  let inserted = 0

  for (let index = 0; index < rows.length; index += INSERT_BATCH_SIZE) {
    const chunk = rows.slice(index, index + INSERT_BATCH_SIZE).map((row) => (
      includeExternalId ? row : stripExternalLeadId(row)
    ))
    const { error } = await getSupabase().from('leads').insert(chunk)
    if (!error) {
      inserted += chunk.length
      continue
    }
    if (includeExternalId && isUnknownExternalLeadIdColumn(error)) {
      includeExternalId = false
      warning = MISSING_COLUMN_WARNING
      const retry = await getSupabase().from('leads').insert(chunk.map(stripExternalLeadId))
      if (retry.error) {
        throw new Error(retry.error.message || 'Could not insert leads')
      }
      inserted += chunk.length
      continue
    }
    throw new Error(error.message || 'Could not insert leads')
  }

  return { inserted, warning }
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
    const seenExternalIds = new Set(existing.externalIds)
    const skipped: SkippedLead[] = []
    const toInsert: Record<string, unknown>[] = []
    const now = new Date().toISOString()
    let warning = existing.warning

    for (const lead of payload.leads) {
      const result = validateLead(lead)
      if (!('ok' in result)) {
        skipped.push(result)
        continue
      }

      if (result.externalId && (existing.externalIds.has(result.externalId) || seenExternalIds.has(result.externalId))) {
        skipped.push({
          business: clean(result.record.business),
          reason: existing.externalIds.has(result.externalId)
            ? 'already imported (Lead ID)'
            : 'Duplicate in this batch',
        })
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
      if (result.externalId) seenExternalIds.add(result.externalId)
      toInsert.push(mapLeadRow(result.record, now, existing.columnAvailable))
    }

    let inserted = 0
    if (!dryRun && toInsert.length > 0) {
      const write = await insertChunks(toInsert, existing.columnAvailable)
      inserted = write.inserted
      if (write.warning) warning = write.warning
      await logActivity({
        action: 'lead_created',
        entity_type: 'lead',
        actor_email: 'leads-import',
        details: `Imported ${inserted} marketing prospects`,
      })
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      received: payload.leads.length,
      inserted: dryRun ? 0 : inserted,
      skipped,
      ...(dryRun ? { wouldInsert: toInsert.length } : {}),
      ...(warning ? { warning } : {}),
    })
  } catch (error) {
    console.error('Leads import failed:', error)
    return NextResponse.json({ error: 'Leads import failed' }, { status: 500 })
  }
}
