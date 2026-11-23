import { after, NextRequest, NextResponse } from 'next/server'
import { mapWithConcurrency } from '@/lib/dispute-letters/async-pool'
import { enrichLead, type LeadForIcp } from '@/lib/icp-enrich'
import { getSupabase } from '@/lib/supabase'
import { timingSafeStringEqual } from '@/lib/timing-safe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest): boolean {
  const header = request.headers.get('authorization')
  return [process.env.CRON_SECRET, process.env.ICP_JOB_SECRET]
    .map((s) => s?.trim())
    .some((s) => Boolean(s) && timingSafeStringEqual(header, `Bearer ${s}`))
}

const MAX_HOPS = 150

/**
 * Scores the next batch of unscored marketing leads, then calls itself again until
 * none remain. Stops when a batch scores nothing (e.g. Places quota) so it never loops on errors.
 * The daily Vercel cron starts the chain; ?chain=0 runs one batch only.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const key = process.env.GOOGLE_API_KEY?.trim()
  if (!key) return NextResponse.json({ error: 'GOOGLE_API_KEY not set' }, { status: 500 })

  const limit = Math.min(40, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 30))
  const db = getSupabase()
  const { data: leads, error } = await db
    .from('leads')
    .select('id, business, industry, location_text, website, email, phone')
    .eq('lead_type', 'marketing_lead')
    .is('icp_scored_at', null)
    .limit(limit)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const outcomes = await mapWithConcurrency((leads || []) as LeadForIcp[], 6, async (lead) => {
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
      const message = err instanceof Error ? err.message : 'unknown'
      // Places quota/auth errors stay unscored for a retry; a lead that breaks on its own is
      // marked so the chain does not pick it again forever.
      if (!/^Places \d/.test(message)) {
        await db
          .from('leads')
          .update({ icp_band: 'error', icp_data: { error: message }, icp_scored_at: new Date().toISOString() })
          .eq('id', lead.id)
      }
      return `error:${message}`
    }
  })

  const { count } = await db
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('lead_type', 'marketing_lead')
    .is('icp_scored_at', null)
  const scored = outcomes.filter((o) => !o.startsWith('error:')).length
  const hop = Number(request.nextUrl.searchParams.get('hop')) || 0
  const chain = request.nextUrl.searchParams.get('chain') !== '0' && scored > 0 && (count ?? 0) > 0 && hop < MAX_HOPS
  if (chain) {
    const next = new URL(request.nextUrl.pathname, request.nextUrl.origin)
    next.searchParams.set('limit', String(limit))
    next.searchParams.set('hop', String(hop + 1))
    const auth = request.headers.get('authorization') || ''
    after(async () => {
      // Fire the next batch; don't wait for it to finish.
      await fetch(next, { headers: { authorization: auth }, signal: AbortSignal.timeout(3_000) }).catch(() => {})
    })
  }
  return NextResponse.json({ ok: true, processed: outcomes.length, scored, outcomes, remaining: count ?? null, hop, chained: chain })
}
