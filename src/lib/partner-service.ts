import { randomBytes } from 'crypto'
import { createUser, getUserByEmail, getUserById } from '@/lib/db'
import { getCreditFundingApplicationById } from '@/lib/credit-funding-db'
import { getSupabase } from '@/lib/supabase'
import { buildReferralPath, generateReferralCode } from '@/lib/referrals'
import { getPublicSiteUrl } from '@/lib/smtp-mail'
import {
  getReferralProfileByPartnerId,
  insertReferralProfile,
  listReferralsForProfile,
  countReferralClicks,
  updateReferralProfile,
} from '@/lib/referral-db'
import {
  getPartnerProfileById,
  getPartnerProfileByUserId,
  insertPartnerProfile,
  listPartnerProfiles,
  updatePartnerProfileStatus,
  type PartnerProfileRow,
  type PartnerStatus,
} from '@/lib/partner-db'
import { toPartnerReferralProgress } from '@/lib/partner-progress'
import type { PartnerSignupInput } from '@/lib/partner-signup'
import { PARTNER_PROFESSION_LABELS } from '@/lib/partner-signup'

async function latestDisputeRound(applicationUuid: string): Promise<number | null> {
  const { data: caseRow, error: caseError } = await getSupabase()
    .from('dispute_cases')
    .select('id')
    .eq('application_uuid', applicationUuid)
    .maybeSingle()
  if (caseError || !caseRow?.id) return null
  const { data: round, error: roundError } = await getSupabase()
    .from('dispute_rounds')
    .select('round_number')
    .eq('case_id', caseRow.id)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (roundError || !round) return null
  const value = Number(round.round_number)
  return Number.isInteger(value) ? value : null
}

async function ensurePartnerReferralCode(partnerProfileId: string, status: 'active' | 'disabled') {
  const existing = await getReferralProfileByPartnerId(partnerProfileId)
  if (existing) return existing
  for (let i = 0; i < 6; i++) {
    const code = generateReferralCode(n => randomBytes(n))
    const referral = await insertReferralProfile({
      partner_profile_id: partnerProfileId,
      referral_code: code,
      status,
    })
    if (referral) return referral
  }
  return null
}

export async function createPartnerAccount(input: PartnerSignupInput): Promise<
  { ok: true } | { ok: false; error: string; status: number }
> {
  const existing = await getUserByEmail(input.email)
  if (existing) {
    return { ok: false, error: 'An account with that email already exists.', status: 409 }
  }

  const user = await createUser({
    email: input.email,
    password: input.password,
    name: input.fullName,
    role: 'partner',
  })
  if (!user) {
    return { ok: false, error: 'Could not create the partner account.', status: 500 }
  }

  const profile = await insertPartnerProfile({
    user_id: user.id,
    phone: input.phone,
    company_name: input.companyName,
    service_area: input.serviceArea,
    years_in_field: input.yearsInField,
    profession: input.profession,
  })
  if (!profile) {
    return { ok: false, error: 'Could not save the partner profile.', status: 500 }
  }

  const referral = await ensurePartnerReferralCode(profile.id, 'disabled')
  if (!referral) return { ok: false, error: 'Could not create a referral link.', status: 500 }
  return { ok: true }
}

export async function getPartnerDashboard(userId: string) {
  const profile = await getPartnerProfileByUserId(userId)
  if (!profile) return { error: 'Partner profile not found.', status: 404 as const }
  const user = await getUserById(userId)
  const referral = await ensurePartnerReferralCode(profile.id, profile.status === 'active' ? 'active' : 'disabled')
  const referrals = referral ? await listReferralsForProfile(referral.id) : []
  const clicks = referral ? await countReferralClicks(referral.id) : 0

  const rows = []
  for (const referralRow of referrals) {
    if (!referralRow.referred_application_id) continue
    const app = await getCreditFundingApplicationById(referralRow.referred_application_id)
    if (!app) continue
    const disputeRound = await latestDisputeRound(app.id)
    rows.push(
      toPartnerReferralProgress({
        id: referralRow.id,
        date: referralRow.application_submitted_at || referralRow.attributed_at,
        fullName: app.full_name,
        status: app.status,
        updatedAt: app.updated_at,
        disputeRound,
      })
    )
  }

  return {
    profile: {
      name: user?.name || '',
      companyName: profile.company_name,
      serviceArea: profile.service_area,
      profession: PARTNER_PROFESSION_LABELS[profile.profession],
      yearsInField: profile.years_in_field,
      status: profile.status,
      code: referral?.referral_code || '',
      link: referral ? `${getPublicSiteUrl()}${buildReferralPath(referral.referral_code)}` : '',
      linkActive: profile.status === 'active' && referral?.status === 'active',
    },
    summary: {
      clicks,
      submitted: rows.length,
      inProgress: rows.filter(row => row.bucket === 'in_progress').length,
      completed: rows.filter(row => row.bucket === 'completed').length,
    },
    referrals: rows,
  }
}

export async function listPartnersForAdmin() {
  const profiles = await listPartnerProfiles()
  const rows = []
  for (const profile of profiles) {
    const user = await getUserById(profile.user_id)
    const referral = await getReferralProfileByPartnerId(profile.id)
    rows.push(adminPartnerRow(profile, user?.name || '', user?.email || '', referral?.referral_code || ''))
  }
  return rows
}

function adminPartnerRow(
  profile: PartnerProfileRow,
  name: string,
  email: string,
  code: string
) {
  return {
    id: profile.id,
    name,
    email,
    phone: profile.phone,
    companyName: profile.company_name,
    serviceArea: profile.service_area,
    yearsInField: profile.years_in_field,
    profession: PARTNER_PROFESSION_LABELS[profile.profession],
    status: profile.status,
    code,
    createdAt: profile.created_at,
  }
}

export async function setPartnerApproval(
  partnerId: string,
  action: 'approve' | 'disable'
): Promise<{ ok: true; status: PartnerStatus } | { ok: false; error: string; status: number }> {
  const profile = await getPartnerProfileById(partnerId)
  if (!profile) return { ok: false, error: 'Partner not found.', status: 404 }
  const next: PartnerStatus = action === 'approve' ? 'active' : 'disabled'
  const updated = await updatePartnerProfileStatus(profile.id, next)
  if (!updated) return { ok: false, error: 'Could not update the partner.', status: 500 }
  const referral = await ensurePartnerReferralCode(profile.id, next === 'active' ? 'active' : 'disabled')
  if (referral && referral.status !== (next === 'active' ? 'active' : 'disabled')) {
    await updateReferralProfile(referral.id, { status: next === 'active' ? 'active' : 'disabled' })
  }
  return { ok: true, status: next }
}
