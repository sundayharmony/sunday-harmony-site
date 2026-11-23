import { NextRequest, NextResponse } from 'next/server'
import { mapWithConcurrency } from '@/lib/dispute-letters/async-pool'
import { enrichLead, type LeadForIcp } from '@/lib/icp-enrich'
import { getSupabase } from '@/lib/supabase'
import { timingSafeStringEqual } from '@/lib/timing-safe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function authorized(request: NextRequest): boolean {
  const header = request.headers.get('authorization')
  return [process.env.CRON_SECRET, process.env.ICP_JOB_SECRET]
    .map((s) => s?.trim())
    .some((s) => Boolean(s) && timingSafeStringEqual(header, `Bearer ${s}`))
}

/** Scores the next batch of unscored marketing leads. Call repeatedly until remaining is 0. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const key = process.env.GOOGLE_API_KEY?.trim()
  if (!key) return NextResponse.json({ error: 'GOOGLE_API_KEY not set' }, { status: 500 })

  const limit = Math.min(20, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 8))
  const db = getSupabase()
  const { data: leads, error } = await db
    .from('leads')
    .select('id, business, industry, location_text, website, email, phone')
    .eq('lead_type', 'marketing_lead')
    .is('icp_scored_at', null)
    .limit(limit)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const outcomes = await mapWithConcurrency((leads || []) as LeadForIcp[], 4, async (lead) => {
    try {
      const e = await enrichLead(lead, key)
      const update: Record<string, unknown> = {
        icp_score: e.result.score,
        icp_band: e.result.band,
        icp_data: { ...e.result, place: e.place, siteUrl: e.siteUrl, emailFound: e.emailFound, emailMx: e.emailMx },
        icp_scored_at: new Date().toISOString(),
      }
      if (!lead.email && e.emailFound && e.emailMx) update.email = e.emailFound
      if (!lead.website && e.place?.website) update.website = e.place.website
      if (!lead.phone && e.place?.phone) update.phone = e.place.phone
      if (e.place?.id) update.google_place_id = e.place.id
      const { error: updateError } = await db.from('leads').update(update).eq('id', lead.id)
      return updateError ? `error:${updateError.message}` : e.result.band
    } catch (err) {
      return `error:${err instanceof Error ? err.message : 'unknown'}`
    }
  })

  const { count } = await db
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('lead_type', 'marketing_lead')
    .is('icp_scored_at', null)
  return NextResponse.json({ ok: true, processed: outcomes.length, outcomes, remaining: count ?? null })
}
