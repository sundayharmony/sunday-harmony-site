import { buildAudit, verifyAuditToken, type Audit, type AuditLead } from '@/lib/icp-audit'
import { getSupabase } from '@/lib/supabase'

/** Loads the audit for a signed link token, or null if the token or lead is not valid. */
export async function loadAudit(token: string): Promise<{ audit: Audit; leadId: string } | null> {
  const leadId = verifyAuditToken(token)
  if (!leadId) return null
  const { data } = await getSupabase()
    .from('leads')
    .select('id, business, location_text, icp_score, icp_data')
    .eq('id', leadId)
    .not('icp_scored_at', 'is', null)
    .maybeSingle()
  if (!data || !(data as AuditLead).icp_data) return null
  return { audit: buildAudit(data as AuditLead), leadId }
}
