import { NextRequest, NextResponse } from 'next/server'
import { mapWithConcurrency } from '@/lib/dispute-letters/async-pool'
import { collectDeepAudit } from '@/lib/icp-deep-audit'
import { getSupabase } from '@/lib/supabase'
import { timingSafeStringEqual } from '@/lib/timing-safe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

type Row = { id: string; google_place_id: string | null; website: string | null; location_text: string | null; icp_data: Record<string, unknown> | null }

/**
 * Collects the full 6-area audit for qualified leads (call/email bands) that don't have one,
 * or for one lead with ?lead=<id>. Saves it to icp_data.audit. Call repeatedly until remaining is 0.
 */
export async function GET(request: NextRequest) {
  const header = request.headers.get('authorization')
  const ok = [process.env.CRON_SECRET, process.env.ICP_JOB_SECRET]
    .map((s) => s?.trim())
    .some((s) => Boolean(s) && timingSafeStringEqual(header, `Bearer ${s}`))
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const places = (process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY || '').trim()
  const pagespeed = (process.env.GOOGLE_API_KEY || process.env.GOOGLE_PLACES_API_KEY || '').trim()
  if (!places) return NextResponse.json({ error: 'Google key not set' }, { status: 500 })

  const db = getSupabase()
  const lead = request.nextUrl.searchParams.get('lead')
  const limit = Math.min(6, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 3))
  let query = db.from('leads').select('id, google_place_id, website, location_text, icp_data')
  query = lead
    ? query.eq('id', lead)
    : query.eq('lead_type', 'marketing_lead').in('icp_band', ['call', 'email']).is('icp_data->audit', null).order('icp_score', { ascending: false }).limit(limit)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const outcomes = await mapWithConcurrency((data || []) as Row[], 3, async (row) => {
    try {
      const audit = await collectDeepAudit(row, { places, pagespeed })
      const { error: e } = await db.from('leads').update({ icp_data: { ...(row.icp_data || {}), audit } }).eq('id', row.id)
      return e ? `error:${e.message}` : 'ok'
    } catch (err) {
      return `error:${err instanceof Error ? err.message : 'unknown'}`
    }
  })

  const { count } = await db
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('lead_type', 'marketing_lead')
    .in('icp_band', ['call', 'email'])
    .is('icp_data->audit', null)
  return NextResponse.json({ ok: true, processed: outcomes.length, outcomes, remaining: count ?? null })
}
