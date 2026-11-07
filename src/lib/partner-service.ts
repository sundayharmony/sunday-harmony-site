import { randomBytes } from 'crypto'
import { createUser, deleteUser, getUserByEmail, getUserById, updateUser, verifyPassword } from '@/lib/db'
import { getCreditFundingApplicationById } from '@/lib/credit-funding-db'
import { getSupabase } from '@/lib/supabase'
import { buildPartnerReferralUrl } from '@/lib/referral-qr'
import { generateReferralCode } from '@/lib/referrals'
import {
  getReferralProfileByPartnerId,
  insertReferralProfile,
  listReferralsForProfile,
  countReferralClicks,
  updateReferralProfile,
} from '@/lib/referral-db'
import { decryptFieldOrLegacy } from '@/lib/field-encryption'
import { partnerLogoPublicUrl } from '@/lib/partner-logos'
import {
  getPartnerProfileById,
  getPartnerProfileByUserId,
  insertPartnerProfile,
  listPartnerProfiles,
  updatePartnerProfile,
  updatePartnerProfileStatus,
  type PartnerProfileRow,
  type PartnerStatus,
} from '@/lib/partner-db'
import {
  partnerCurrentScores,
  partnerReferralSummary,
  referralStatusForPartnerProfile,
  toPartnerReferralProgress,
} from '@/lib/partner-progress'
import { buildCreditProgressDiff } from '@/lib/dispute-letters/credit-progress'
import { listDisputeSessionsForApplication } from '@/lib/dispute-letters/db'
import type { PartnerProfileUpdateInput, PartnerSignupInput } from '@/lib/partner-signup'
import { partnerProfessionLabel, planPartnerSignupUser } from '@/lib/partner-signup'

async function currentScoresForApplication(applicationUuid: string) {
  const sessions = await listDisputeSessionsForApplication(applicationUuid)
  return partnerCurrentScores(buildCreditProgressDiff(sessions, null).current?.bureauScores)
}

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
  if (existing) {
    if (existing.status === status) return existing
    const updated = await updateReferralProfile(existing.id, { status })
    return updated || { ...existing, status }
  }
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

export function adminPartnerReferralContact(app: {
  full_name?: string | null
  email?: string | null
  phone?: string | null
  application_id?: string | null
  id?: string | null
}) {
  return {
    applicant: app.full_name || 'Applicant',
    email: app.email || '',
    phone: decryptFieldOrLegacy(app.phone),
    applicationId: app.application_id || '',
    applicationUuid: app.id || '',
  }
}

export async function createPartnerAccount(input: PartnerSignupInput): Promise<
  { ok: true } | { ok: false; error: string; status: number }
> {
  const existing = await getUserByEmail(input.email)
  const existingProfile = existing ? await getPartnerProfileByUserId(existing.id) : null
  const plan = planPartnerSignupUser(existing, Boolean(existingProfile))
  if (plan === 'conflict') {
    return { ok: false, error: 'An account with that email already exists.', status: 409 }
  }

  let user = existing || null
  let createdUser = false
  if (plan === 'create') {
    user = await createUser({
      email: input.email,
      password: input.password,
      name: input.fullName,
      role: 'partner',
    })
    if (!user) {
      return { ok: false, error: 'Could not create the partner account.', status: 500 }
    }
    createdUser = true
  } else if (!user || !verifyPassword(input.password, user.password)) {
    return { ok: false, error: 'An account with that email already exists.', status: 409 }
  } else if (user.name !== input.fullName) {
    await updateUser(user.id, { name: input.fullName })
  }

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
    if (createdUser) {
      const removed = await deleteUser(user.id)
      if (!removed) console.error('createPartnerAccount leftover user:', user.id)
    }
    return { ok: false, error: 'Could not save the partner profile.', status: 500 }
  }

  await ensurePartnerReferralCode(profile.id, 'disabled')
  return { ok: true }
}

export async function updatePartnerAccount(
  userId: string,
  input: PartnerProfileUpdateInput
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const profile = await getPartnerProfileByUserId(userId)
  if (!profile) return { ok: false, error: 'Partner profile not found.', status: 404 }
  const user = await updateUser(userId, { name: input.fullName })
  if (!user) return { ok: false, error: 'Could not update your name.', status: 500 }
  const updated = await updatePartnerProfile(profile.id, {
    phone: input.phone,
    company_name: input.companyName,
    service_area: input.serviceArea,
    years_in_field: input.yearsInField,
    profession: input.profession,
  })
  if (!updated) return { ok: false, error: 'Could not save your account.', status: 500 }
  return { ok: true }
}

export async function changePartnerPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const user = await getUserById(userId)
  if (!user || !verifyPassword(currentPassword, user.password)) {
    return { ok: false, error: 'Current password is incorrect.', status: 400 }
  }
  const updated = await updateUser(userId, { password: newPassword })
  if (!updated) return { ok: false, error: 'Could not update your password.', status: 500 }
  return { ok: true }
}

export async function getPartnerDashboard(userId: string) {
  const profile = await getPartnerProfileByUserId(userId)
  if (!profile) return { error: 'Partner profile not found.', status: 404 as const }
  const user = await getUserById(userId)
  const referral = await ensurePartnerReferralCode(
    profile.id,
    referralStatusForPartnerProfile(profile.status)
  )
  const referrals = referral ? await listReferralsForProfile(referral.id) : []
  const clicks = referral ? await countReferralClicks(referral.id) : 0

  const rows = []
  for (const referralRow of referrals) {
    try {
      if (!referralRow.referred_application_id) continue
      const app = await getCreditFundingApplicationById(referralRow.referred_application_id)
      if (!app) continue
      const disputeRound = await latestDisputeRound(app.id)
      const currentScores = await currentScoresForApplication(app.id)
      rows.push(
        toPartnerReferralProgress({
          id: referralRow.id,
          date: referralRow.application_submitted_at || referralRow.attributed_at,
          fullName: app.full_name,
          status: app.status,
          updatedAt: app.updated_at,
          disputeRound,
          currentScores,
        })
      )
    } catch (error) {
      console.error('partner dashboard referral row error:', error)
    }
  }

  return {
    profile: {
      name: user?.name || '',
      email: user?.email || '',
      companyName: profile.company_name,
      serviceArea: profile.service_area,
      phone: profile.phone,
      profession: partnerProfessionLabel(profile.profession),
      professionValue: profile.profession,
      yearsInField: profile.years_in_field,
      status: profile.status,
      code: referral?.referral_code || '',
      link: referral ? buildPartnerReferralUrl(referral.referral_code) : '',
      linkActive: profile.status === 'active' && referral?.status === 'active',
    },
    summary: partnerReferralSummary(rows, clicks),
    referrals: rows,
  }
}

async function partnerReferralActivity(partnerProfileId: string) {
  const referral = await getReferralProfileByPartnerId(partnerProfileId)
  const referrals = referral ? await listReferralsForProfile(referral.id) : []
  const clicks = referral ? await countReferralClicks(referral.id) : 0
  const rows = []
  for (const referralRow of referrals) {
    try {
      if (!referralRow.referred_application_id) continue
      const app = await getCreditFundingApplicationById(referralRow.referred_application_id)
      if (!app) continue
      const disputeRound = await latestDisputeRound(app.id)
      const currentScores = await currentScoresForApplication(app.id)
      const progress = toPartnerReferralProgress({
        id: referralRow.id,
        date: referralRow.application_submitted_at || referralRow.attributed_at,
        fullName: app.full_name,
        status: app.status,
        updatedAt: app.updated_at,
        disputeRound,
        currentScores,
      })
      rows.push({
        ...progress,
        ...adminPartnerReferralContact(app),
      })
    } catch (error) {
      console.error('admin partner referral row error:', error)
    }
  }
  return {
    referral,
    clicks,
    rows,
    summary: partnerReferralSummary(rows, clicks),
  }
}

export async function listPartnersForAdmin() {
  const profiles = await listPartnerProfiles()
  const rows = []
  for (const profile of profiles) {
    const user = await getUserById(profile.user_id)
    await ensurePartnerReferralCode(profile.id, referralStatusForPartnerProfile(profile.status))
    const activity = await partnerReferralActivity(profile.id)
    const code = activity.referral?.referral_code || ''
    rows.push({
      ...adminPartnerRow(profile, user?.name || '', user?.email || '', code),
      link: code ? buildPartnerReferralUrl(code) : '',
      linkActive: profile.status === 'active' && activity.referral?.status === 'active',
      clicks: activity.summary.clicks,
      submitted: activity.summary.submitted,
      inProgress: activity.summary.inProgress,
      completed: activity.summary.completed,
    })
  }
  return rows
}

export async function getAdminPartnerDetail(partnerId: string) {
  const profile = await getPartnerProfileById(partnerId)
  if (!profile) return { error: 'Partner not found.', status: 404 as const }
  const user = await getUserById(profile.user_id)
  await ensurePartnerReferralCode(profile.id, referralStatusForPartnerProfile(profile.status))
  const activity = await partnerReferralActivity(profile.id)
  return {
    partner: {
      ...adminPartnerRow(profile, user?.name || '', user?.email || '', activity.referral?.referral_code || ''),
      link: activity.referral ? buildPartnerReferralUrl(activity.referral.referral_code) : '',
      linkActive: profile.status === 'active' && activity.referral?.status === 'active',
    },
    summary: activity.summary,
    referrals: activity.rows,
  }
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
    profession: partnerProfessionLabel(profile.profession),
    status: profile.status,
    code,
    createdAt: profile.created_at,
    logoUrl: partnerLogoPublicUrl(profile.logo_path),
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
  await ensurePartnerReferralCode(profile.id, referralStatusForPartnerProfile(next))
  return { ok: true, status: next }
}
