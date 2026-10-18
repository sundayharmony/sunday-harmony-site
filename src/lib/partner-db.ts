import { getSupabase } from '@/lib/supabase'
import type { PartnerProfession } from '@/lib/partner-signup'

export type PartnerStatus = 'pending' | 'active' | 'disabled'

export type PartnerProfileRow = {
  id: string
  user_id: string
  phone: string
  company_name: string
  service_area: string
  years_in_field: number
  profession: PartnerProfession
  status: PartnerStatus
  logo_path: string | null
  created_at: string
  updated_at: string
}

function missingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function missingLogoColumn(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    /logo_path|schema cache/i.test(error?.message || '')
  )
}

export async function getPartnerProfileByUserId(userId: string): Promise<PartnerProfileRow | null> {
  const { data, error } = await getSupabase()
    .from('partner_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    if (missingTable(error)) return null
    console.error('getPartnerProfileByUserId:', error)
    return null
  }
  return (data as PartnerProfileRow) || null
}

export async function getPartnerProfileById(id: string): Promise<PartnerProfileRow | null> {
  const { data, error } = await getSupabase()
    .from('partner_profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (missingTable(error)) return null
    console.error('getPartnerProfileById:', error)
    return null
  }
  return (data as PartnerProfileRow) || null
}

export async function listPartnerProfiles(): Promise<PartnerProfileRow[]> {
  const { data, error } = await getSupabase()
    .from('partner_profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    if (missingTable(error)) return []
    console.error('listPartnerProfiles:', error)
    return []
  }
  return (data || []) as PartnerProfileRow[]
}

export async function insertPartnerProfile(row: {
  user_id: string
  phone: string
  company_name: string
  service_area: string
  years_in_field: number
  profession: PartnerProfession
}): Promise<PartnerProfileRow | null> {
  const now = new Date().toISOString()
  const { data, error } = await getSupabase()
    .from('partner_profiles')
    .insert({
      ...row,
      status: 'pending',
      created_at: now,
      updated_at: now,
    })
    .select()
    .single()
  if (error) {
    console.error('insertPartnerProfile:', error)
    return null
  }
  return data as PartnerProfileRow
}

export async function listActivePartnerLogoRows(): Promise<{ company_name: string; logo_path: string }[]> {
  const { data, error } = await getSupabase()
    .from('partner_profiles')
    .select('company_name, logo_path')
    .eq('status', 'active')
    .not('logo_path', 'is', null)
    .order('company_name', { ascending: true })
  if (error) {
    if (missingTable(error) || missingLogoColumn(error)) return []
    console.error('listActivePartnerLogoRows:', error)
    return []
  }
  return ((data || []) as { company_name: string; logo_path: string | null }[]).flatMap(row =>
    row.logo_path ? [{ company_name: row.company_name, logo_path: row.logo_path }] : []
  )
}

export async function updatePartnerLogoPath(
  id: string,
  logoPath: string | null
): Promise<{ ok: true; profile: PartnerProfileRow } | { ok: false; missingColumn: boolean }> {
  const { data, error } = await getSupabase()
    .from('partner_profiles')
    .update({ logo_path: logoPath, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('updatePartnerLogoPath:', error)
    return { ok: false, missingColumn: missingLogoColumn(error) }
  }
  return { ok: true, profile: data as PartnerProfileRow }
}

export async function updatePartnerProfileStatus(
  id: string,
  status: PartnerStatus
): Promise<PartnerProfileRow | null> {
  const { data, error } = await getSupabase()
    .from('partner_profiles')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('updatePartnerProfileStatus:', error)
    return null
  }
  return data as PartnerProfileRow
}
