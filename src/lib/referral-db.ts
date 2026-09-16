import { getSupabase } from '@/lib/supabase'
import type { CommissionStatus, PayoutStatus, ReferralStatus } from '@/lib/referrals'

export type ReferralProfileRow = {
  id: string
  client_id: string
  referral_code: string
  status: 'active' | 'disabled'
  stripe_connect_account_id: string | null
  payout_ready: boolean
  created_at: string
  updated_at: string
}

export type ReferralRow = {
  id: string
  referral_profile_id: string
  referred_application_id: string | null
  referred_client_id: string | null
  referral_status: ReferralStatus
  attributed_at: string
  application_submitted_at: string | null
  qualifying_payment_at: string | null
  created_at: string
  updated_at: string
}

export type ReferralCommissionRow = {
  id: string
  referral_id: string
  referred_client_id: string | null
  qualifying_payment_id: string
  amount_cents: number
  status: CommissionStatus
  earned_at: string
  available_at: string
  paid_at: string | null
  payout_id: string | null
  cancelled_reason: string | null
  created_at: string
  updated_at: string
}

export type ReferralPayoutRow = {
  id: string
  client_id: string
  referral_profile_id: string
  amount_cents: number
  payment_provider: string
  provider_transaction_id: string | null
  status: PayoutStatus
  requested_at: string
  processed_at: string | null
  failed_at: string | null
  failure_reason: string | null
  initiated_by_email: string | null
  created_at: string
  updated_at: string
}

export async function getReferralProfileByClientId(clientId: string): Promise<ReferralProfileRow | null> {
  const { data, error } = await getSupabase()
    .from('referral_profiles')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return null
    console.error('getReferralProfileByClientId:', error)
    return null
  }
  return (data as ReferralProfileRow) || null
}

export async function getReferralProfileByCode(code: string): Promise<ReferralProfileRow | null> {
  const { data, error } = await getSupabase()
    .from('referral_profiles')
    .select('*')
    .eq('referral_code', code)
    .maybeSingle()
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return null
    console.error('getReferralProfileByCode:', error)
    return null
  }
  return (data as ReferralProfileRow) || null
}

export async function getReferralProfileById(id: string): Promise<ReferralProfileRow | null> {
  const { data, error } = await getSupabase()
    .from('referral_profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return null
    console.error('getReferralProfileById:', error)
    return null
  }
  return (data as ReferralProfileRow) || null
}

export async function insertReferralProfile(row: {
  client_id: string
  referral_code: string
  status?: 'active' | 'disabled'
}): Promise<ReferralProfileRow | null> {
  const { data, error } = await getSupabase()
    .from('referral_profiles')
    .insert({
      client_id: row.client_id,
      referral_code: row.referral_code,
      status: row.status || 'active',
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) {
    console.error('insertReferralProfile:', error)
    return null
  }
  return data as ReferralProfileRow
}

export async function updateReferralProfile(
  id: string,
  patch: Partial<
    Pick<
      ReferralProfileRow,
      'referral_code' | 'status' | 'stripe_connect_account_id' | 'payout_ready'
    >
  >
): Promise<ReferralProfileRow | null> {
  const { data, error } = await getSupabase()
    .from('referral_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('updateReferralProfile:', error)
    return null
  }
  return data as ReferralProfileRow
}

export async function insertReferralClick(row: {
  referral_profile_id: string
  attribution_id: string
  landing_path?: string | null
  ip_hash?: string | null
  user_agent?: string | null
}): Promise<void> {
  const { error } = await getSupabase().from('referral_clicks').insert({
    referral_profile_id: row.referral_profile_id,
    attribution_id: row.attribution_id,
    landing_path: row.landing_path || null,
    ip_hash: row.ip_hash || null,
    user_agent: row.user_agent || null,
  })
  if (error) console.error('insertReferralClick:', error)
}

export async function countReferralClicks(profileId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from('referral_clicks')
    .select('id', { count: 'exact', head: true })
    .eq('referral_profile_id', profileId)
  if (error) return 0
  return count || 0
}

export async function insertReferral(row: {
  referral_profile_id: string
  referred_application_id: string
  referred_client_id?: string | null
  referral_status: ReferralStatus
  application_submitted_at?: string | null
}): Promise<ReferralRow | null> {
  const now = new Date().toISOString()
  const { data, error } = await getSupabase()
    .from('referrals')
    .insert({
      referral_profile_id: row.referral_profile_id,
      referred_application_id: row.referred_application_id,
      referred_client_id: row.referred_client_id || null,
      referral_status: row.referral_status,
      attributed_at: now,
      application_submitted_at: row.application_submitted_at || now,
      updated_at: now,
    })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') {
      const existing = await getReferralByApplicationId(row.referred_application_id)
      return existing
    }
    console.error('insertReferral:', error)
    return null
  }
  return data as ReferralRow
}

export async function getReferralByApplicationId(applicationId: string): Promise<ReferralRow | null> {
  const { data, error } = await getSupabase()
    .from('referrals')
    .select('*')
    .eq('referred_application_id', applicationId)
    .maybeSingle()
  if (error) {
    console.error('getReferralByApplicationId:', error)
    return null
  }
  return (data as ReferralRow) || null
}

export async function getReferralsByReferredClientId(clientId: string): Promise<ReferralRow[]> {
  const { data, error } = await getSupabase()
    .from('referrals')
    .select('*')
    .eq('referred_client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('getReferralsByReferredClientId:', error)
    return []
  }
  return (data || []) as ReferralRow[]
}

export async function listReferralsForProfile(profileId: string): Promise<ReferralRow[]> {
  const { data, error } = await getSupabase()
    .from('referrals')
    .select('*')
    .eq('referral_profile_id', profileId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('listReferralsForProfile:', error)
    return []
  }
  return (data || []) as ReferralRow[]
}

export async function updateReferral(
  id: string,
  patch: Partial<
    Pick<
      ReferralRow,
      | 'referred_client_id'
      | 'referral_status'
      | 'application_submitted_at'
      | 'qualifying_payment_at'
    >
  >
): Promise<void> {
  const { error } = await getSupabase()
    .from('referrals')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) console.error('updateReferral:', error)
}

export async function insertReferralEvent(row: {
  referral_id?: string | null
  referral_profile_id: string
  event_type: string
  detail?: string | null
}): Promise<void> {
  const { error } = await getSupabase().from('referral_events').insert({
    referral_id: row.referral_id || null,
    referral_profile_id: row.referral_profile_id,
    event_type: row.event_type,
    detail: row.detail || null,
  })
  if (error) console.error('insertReferralEvent:', error)
}

export async function listReferralEvents(profileId: string, referralId?: string) {
  let query = getSupabase()
    .from('referral_events')
    .select('*')
    .eq('referral_profile_id', profileId)
    .order('created_at', { ascending: true })
  if (referralId) query = query.eq('referral_id', referralId)
  const { data, error } = await query
  if (error) {
    console.error('listReferralEvents:', error)
    return []
  }
  return data || []
}

export async function insertCommission(row: {
  referral_id: string
  referred_client_id?: string | null
  qualifying_payment_id: string
  amount_cents: number
  status: CommissionStatus
  available_at: string
}): Promise<ReferralCommissionRow | null> {
  const now = new Date().toISOString()
  const { data, error } = await getSupabase()
    .from('referral_commissions')
    .insert({
      ...row,
      earned_at: now,
      updated_at: now,
    })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') return null
    console.error('insertCommission:', error)
    return null
  }
  return data as ReferralCommissionRow
}

export async function getCommissionByPaymentId(paymentId: string): Promise<ReferralCommissionRow | null> {
  const { data, error } = await getSupabase()
    .from('referral_commissions')
    .select('*')
    .eq('qualifying_payment_id', paymentId)
    .maybeSingle()
  if (error) {
    console.error('getCommissionByPaymentId:', error)
    return null
  }
  return (data as ReferralCommissionRow) || null
}

export async function getActiveCommissionForReferredClient(
  referredClientId: string
): Promise<ReferralCommissionRow | null> {
  const { data, error } = await getSupabase()
    .from('referral_commissions')
    .select('*')
    .eq('referred_client_id', referredClientId)
    .not('status', 'in', '(cancelled,revoked)')
    .maybeSingle()
  if (error) {
    console.error('getActiveCommissionForReferredClient:', error)
    return null
  }
  return (data as ReferralCommissionRow) || null
}

export async function listCommissionsForReferrals(referralIds: string[]): Promise<ReferralCommissionRow[]> {
  if (referralIds.length === 0) return []
  const { data, error } = await getSupabase()
    .from('referral_commissions')
    .select('*')
    .in('referral_id', referralIds)
  if (error) {
    console.error('listCommissionsForReferrals:', error)
    return []
  }
  return (data || []) as ReferralCommissionRow[]
}

export async function listCommissionsForProfileReferrals(
  profileId: string
): Promise<ReferralCommissionRow[]> {
  const referrals = await listReferralsForProfile(profileId)
  return listCommissionsForReferrals(referrals.map(r => r.id))
}

export async function updateCommission(
  id: string,
  patch: Partial<
    Pick<ReferralCommissionRow, 'status' | 'paid_at' | 'payout_id' | 'cancelled_reason' | 'available_at'>
  >
): Promise<void> {
  const { error } = await getSupabase()
    .from('referral_commissions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) console.error('updateCommission:', error)
}

export async function listAvailableCommissions(profileId: string): Promise<ReferralCommissionRow[]> {
  const all = await listCommissionsForProfileReferrals(profileId)
  const now = Date.now()
  return all.filter(c => {
    if (c.status === 'available') return true
    if (c.status === 'pending' && Date.parse(c.available_at) <= now) return true
    return false
  })
}

export async function insertPayout(row: {
  client_id: string
  referral_profile_id: string
  amount_cents: number
  payment_provider: string
  status: PayoutStatus
  initiated_by_email?: string | null
  provider_transaction_id?: string | null
}): Promise<ReferralPayoutRow | null> {
  const { data, error } = await getSupabase()
    .from('referral_payouts')
    .insert({
      ...row,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) {
    console.error('insertPayout:', error)
    return null
  }
  return data as ReferralPayoutRow
}

export async function updatePayout(
  id: string,
  patch: Partial<
    Pick<
      ReferralPayoutRow,
      'status' | 'provider_transaction_id' | 'processed_at' | 'failed_at' | 'failure_reason'
    >
  >
): Promise<ReferralPayoutRow | null> {
  const { data, error } = await getSupabase()
    .from('referral_payouts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('updatePayout:', error)
    return null
  }
  return data as ReferralPayoutRow
}

export async function getPayoutById(id: string): Promise<ReferralPayoutRow | null> {
  const { data, error } = await getSupabase().from('referral_payouts').select('*').eq('id', id).maybeSingle()
  if (error) {
    console.error('getPayoutById:', error)
    return null
  }
  return (data as ReferralPayoutRow) || null
}

export async function getPayoutByProviderId(providerId: string): Promise<ReferralPayoutRow | null> {
  const { data, error } = await getSupabase()
    .from('referral_payouts')
    .select('*')
    .eq('provider_transaction_id', providerId)
    .maybeSingle()
  if (error) {
    console.error('getPayoutByProviderId:', error)
    return null
  }
  return (data as ReferralPayoutRow) || null
}

export async function listPayoutsForClient(clientId: string): Promise<ReferralPayoutRow[]> {
  const { data, error } = await getSupabase()
    .from('referral_payouts')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('listPayoutsForClient:', error)
    return []
  }
  return (data || []) as ReferralPayoutRow[]
}

export async function listAllReferralProfiles(): Promise<ReferralProfileRow[]> {
  const { data, error } = await getSupabase()
    .from('referral_profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return []
    console.error('listAllReferralProfiles:', error)
    return []
  }
  return (data || []) as ReferralProfileRow[]
}

export async function listCommissionsByPayoutId(payoutId: string): Promise<ReferralCommissionRow[]> {
  const { data, error } = await getSupabase()
    .from('referral_commissions')
    .select('*')
    .eq('payout_id', payoutId)
  if (error) {
    console.error('listCommissionsByPayoutId:', error)
    return []
  }
  return (data || []) as ReferralCommissionRow[]
}

export async function countClicksAll(): Promise<number> {
  const { count, error } = await getSupabase()
    .from('referral_clicks')
    .select('id', { count: 'exact', head: true })
  if (error) return 0
  return count || 0
}

export async function listAllPayouts(): Promise<ReferralPayoutRow[]> {
  const { data, error } = await getSupabase()
    .from('referral_payouts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return []
    console.error('listAllPayouts:', error)
    return []
  }
  return (data || []) as ReferralPayoutRow[]
}

export async function getCommissionById(id: string): Promise<ReferralCommissionRow | null> {
  const { data, error } = await getSupabase()
    .from('referral_commissions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('getCommissionById:', error)
    return null
  }
  return (data as ReferralCommissionRow) || null
}
