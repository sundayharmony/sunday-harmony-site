import { sanitizeGroundedText } from './copy-rules'

export type LeadFactSource = {
  id?: string | null
  first_name?: string | null
  last_name?: string | null
  business?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  location_text?: string | null
  industry?: string | null
  marketing_opportunity?: string | null
  recommended_service?: string | null
  notes?: string | null
  pipeline_stage?: string | null
  last_contacted_at?: string | null
  gmail_thread_id?: string | null
  source?: string | null
  lead_type?: string | null
}

export type GroundedFacts = {
  business: string
  firstName: string | null
  location: string | null
  industry: string | null
  observation: string | null
  recommendedService: string | null
  website: string | null
}

const PLACEHOLDER_NAMES = new Set([
  'name',
  'there',
  'friend',
  'owner',
  'contact',
  'team',
  'not',
  'none',
  'unknown',
  'missing',
  'n/a',
  'na',
  'tbd',
  'test',
  'admin',
  'info',
  'null',
])

export function usableFirstName(raw?: string | null): string | null {
  const value = (raw || '').trim()
  if (!value) return null
  if (value.includes('&') || value.includes('/')) return null
  if (/^(not\s+(found|available|provided|listed|sure)|n\/a|none|unknown)/i.test(value)) return null
  const first = value.split(/\s+/)[0]
  if (!first) return null
  if (PLACEHOLDER_NAMES.has(first.toLowerCase())) return null
  if (!/^[A-Za-z][A-Za-z'.-]*$/.test(first)) return null
  return first
}

export function extractGroundedFacts(lead: LeadFactSource): GroundedFacts | null {
  const business = sanitizeGroundedText(lead.business || '')
  if (!business) return null
  const observationRaw = sanitizeGroundedText(lead.marketing_opportunity || '')
  return {
    business,
    firstName: usableFirstName(lead.first_name),
    location: sanitizeGroundedText(lead.location_text || '') || null,
    industry: sanitizeGroundedText(lead.industry || '') || null,
    observation: observationRaw || null,
    recommendedService: sanitizeGroundedText(lead.recommended_service || '') || null,
    website: (lead.website || '').trim() || null,
  }
}
