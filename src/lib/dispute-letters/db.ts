import { getSupabase } from '@/lib/supabase'
import type { DisputeSessionListItem, DisputeSessionStatus, ParsedReport } from '@/lib/dispute-letters/types'

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

export async function createDisputeSession(params: {
  id: string
  adminUserId: string
  storagePath: string
  fileName: string
}): Promise<
  { ok: true; data: DisputeSessionListItem } | { ok: false; error: string }
> {
  const now = new Date().toISOString()
  const { data, error } = await getSupabase()
    .from('dispute_sessions')
    .insert({
      id: params.id,
      admin_user_id: params.adminUserId,
      status: 'uploaded',
      storage_path: params.storagePath,
      file_name: params.fileName,
      file_type: '',
      created_at: now,
      updated_at: now,
    })
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

  const { error } = await getSupabase().from('dispute_sessions').update(payload).eq('id', sessionId)
  if (error) console.error('updateDisputeSessionReport error:', error)
}
