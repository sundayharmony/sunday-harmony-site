import { getSupabase } from '@/lib/supabase'
import type {
  CreditIntelligenceReport,
  DisputeSessionListItem,
  DisputeSessionStatus,
  ParsedReport,
} from '@/lib/dispute-letters/types'

export async function listDisputeSessions(adminUserId: string): Promise<DisputeSessionListItem[]> {
  const { data, error } = await getSupabase()
    .from('dispute_sessions')
    .select('*')
    .eq('admin_user_id', adminUserId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('listDisputeSessions error:', error)
    return []
  }
  return (data || []) as DisputeSessionListItem[]
}

export async function listDisputeSessionsForApplication(
  applicationUuid: string
): Promise<DisputeSessionListItem[]> {
  const { data, error } = await getSupabase()
    .from('dispute_sessions')
    .select('*')
    .eq('application_uuid', applicationUuid)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('listDisputeSessionsForApplication error:', error)
    return []
  }
  return (data || []) as DisputeSessionListItem[]
}

export async function getDisputeSession(
  sessionId: string,
  adminUserId: string
): Promise<DisputeSessionListItem | null> {
  const { data, error } = await getSupabase()
    .from('dispute_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('admin_user_id', adminUserId)
    .maybeSingle()

  if (error) {
    console.error('getDisputeSession error:', error)
    return null
  }
  return (data as DisputeSessionListItem) || null
}

export async function getDisputeSessionById(
  sessionId: string
): Promise<DisputeSessionListItem | null> {
  const { data, error } = await getSupabase()
    .from('dispute_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()

  if (error) {
    console.error('getDisputeSessionById error:', error)
    return null
  }
  return (data as DisputeSessionListItem) || null
}

export async function createDisputeSession(params: {
  id: string
  adminUserId: string
  storagePath: string
  fileName: string
  applicationUuid?: string | null
}): Promise<
  { ok: true; data: DisputeSessionListItem } | { ok: false; error: string }
> {
  const now = new Date().toISOString()
  const row: Record<string, unknown> = {
    id: params.id,
    admin_user_id: params.adminUserId,
    status: 'uploaded',
    storage_path: params.storagePath,
    file_name: params.fileName,
    file_type: '',
    created_at: now,
    updated_at: now,
  }
  if (params.applicationUuid) {
    row.application_uuid = params.applicationUuid
  }

  const { data, error } = await getSupabase()
    .from('dispute_sessions')
    .insert(row)
    .select('*')
    .single()

  if (error) {
    console.error('createDisputeSession error:', error)
    return { ok: false, error: error.message || 'Database insert failed' }
  }
  return { ok: true, data: data as DisputeSessionListItem }
}

export async function updateDisputeSessionStatus(
  sessionId: string,
  status: DisputeSessionStatus,
  errorMessage?: string | null
): Promise<void> {
  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (errorMessage !== undefined) payload.error_message = errorMessage

  const { error } = await getSupabase().from('dispute_sessions').update(payload).eq('id', sessionId)
  if (error) console.error('updateDisputeSessionStatus error:', error)
}

export async function updateDisputeSessionReport(
  sessionId: string,
  report: ParsedReport,
  fileType?: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    report_json: report,
    status: 'ready',
    error_message: null,
    updated_at: new Date().toISOString(),
  }
  if (fileType) payload.file_type = fileType
  if (report.credit_intelligence) {
    payload.intelligence_json = report.credit_intelligence
  }

  const { error } = await getSupabase().from('dispute_sessions').update(payload).eq('id', sessionId)
  if (error) console.error('updateDisputeSessionReport error:', error)
}

export async function updateDisputeSessionIntelligence(
  sessionId: string,
  intelligence: CreditIntelligenceReport
): Promise<void> {
  const { data: existing } = await getSupabase()
    .from('dispute_sessions')
    .select('report_json')
    .eq('id', sessionId)
    .maybeSingle()

  const reportJson = (existing?.report_json as ParsedReport | null) || null
  const nextReport = reportJson
    ? { ...reportJson, credit_intelligence: intelligence }
    : null

  const payload: Record<string, unknown> = {
    intelligence_json: intelligence,
    updated_at: new Date().toISOString(),
  }
  if (nextReport) payload.report_json = nextReport

  const { error } = await getSupabase().from('dispute_sessions').update(payload).eq('id', sessionId)
  if (error) console.error('updateDisputeSessionIntelligence error:', error)
}
