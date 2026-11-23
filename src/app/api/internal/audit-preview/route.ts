import { NextRequest, NextResponse } from 'next/server'
import { auditUrl, buildAudit, type AuditLead } from '@/lib/icp-audit'
import { auditEmailIssues, renderAuditEmail } from '@/lib/outreach/audit-email'
import { getSupabase } from '@/lib/supabase'
import { timingSafeStringEqual } from '@/lib/timing-safe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Staff preview: one lead's audit link and email, for approval before sending is wired up. */
export async function GET(request: NextRequest) {
  const header = request.headers.get('authorization')
  const ok = [process.env.CRON_SECRET, process.env.ICP_JOB_SECRET]
    .map((s) => s?.trim())
    .some((s) => Boolean(s) && timingSafeStringEqual(header, `Bearer ${s}`))
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('lead') || ''
  const { data, error } = await getSupabase()
    .from('leads')
    .select('id, business, location_text, icp_score, icp_data, first_name')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return NextResponse.json({ error: error?.message || 'Lead not found' }, { status: 404 })

  const audit = buildAudit(data as AuditLead)
  const url = auditUrl(data.id)
  const email = renderAuditEmail({
    audit,
    auditUrl: url,
    unsubscribeUrl: 'https://www.sundayharmony.com/unsubscribe/preview-disabled',
    firstName: (data as { first_name?: string | null }).first_name || null,
  })
  const issues = auditEmailIssues(email, { score: data.icp_score, suppressed: false, auditUrl: url })
  return NextResponse.json({ auditUrl: url, email, issues })
}
