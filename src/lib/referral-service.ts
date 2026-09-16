import { randomBytes, createHash } from 'crypto'
import type { NextRequest, NextResponse } from 'next/server'
import { getClientById, getUserByEmail, createNotification, logActivity, type Client } from '@/lib/db'
import { getCreditFundingApplicationById, getCreditFundingApplicationByClientId } from '@/lib/credit-funding-db'
import { isCreditRepairBillingClient } from '@/lib/credit-repair-billing'
import { getPublicSiteUrl, sendHtmlMailNonBlocking, clientDashboardAlertEmailHtml } from '@/lib/smtp-mail'
import { getStripe } from '@/lib/stripe'
import { getClientIp } from '@/lib/rate-limit'
import { getSupabase } from '@/lib/supabase'
import {
  buildReferralPath,
  formatCommissionCents,
  generateReferralCode,
  isQualifyingRepairPayment,
  maskApplicantName,
  nextCommissionStatusAfterHold,
  normalizeReferralCode,
  referralCommissionCents,
  referralHoldDays,
  shouldCreateCommission,
  type CommissionStatus,
} from '@/lib/referrals'
import { readReferralAttributionFromRequest, setReferralAttributionCookie } from '@/lib/referral-attribution'
import {
  countClicksAll,
  countReferralClicks,
  getActiveCommissionForReferredClient,
  getCommissionByPaymentId,
  getPayoutById,
  getPayoutByProviderId,
  getReferralByApplicationId,
  getCommissionById,
  getReferralProfileByClientId,
  getReferralProfileByCode,
  getReferralProfileById,
  getReferralsByReferredClientId,
  listAllPayouts,
  insertCommission,
  insertPayout,
  insertReferral,
  insertReferralClick,
  insertReferralEvent,
  insertReferralProfile,
  listAllReferralProfiles,
  listAvailableCommissions,
  listCommissionsByPayoutId,
  listCommissionsForReferrals,
  listPayoutsForClient,
  listReferralEvents,
  listReferralsForProfile,
  updateCommission,
  updatePayout,
  updateReferral,
  updateReferralProfile,
  type ReferralCommissionRow,
  type ReferralProfileRow,
  type ReferralRow,
} from '@/lib/referral-db'

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

async function getUserForClient(clientId: string, email?: string | null) {
  if (email) {
    const byEmail = await getUserByEmail(email)
    if (byEmail) return byEmail
  }
  const { data } = await getSupabase().from('users').select('id, email, client_id').eq('client_id', clientId).maybeSingle()
  return data as { id: string; email?: string | null } | null
}

export function publicReferralUrl(code: string): string {
  return `${getPublicSiteUrl()}${buildReferralPath(code)}`
}

export async function ensureReferralProfileForClient(clientId: string): Promise<ReferralProfileRow | null> {
  const existing = await getReferralProfileByClientId(clientId)
  if (existing) return existing
  const client = await getClientById(clientId)
  if (!client || !isCreditRepairBillingClient(client)) return null

  for (let i = 0; i < 6; i++) {
    const code = generateReferralCode(n => randomBytes(n))
    const created = await insertReferralProfile({ client_id: clientId, referral_code: code })
    if (created) return created
  }
  return getReferralProfileByClientId(clientId)
}

export async function ensureReferralProfileIfRepairClient(client: Client | null | undefined): Promise<void> {
  if (!client?.id || !isCreditRepairBillingClient(client)) return
  await ensureReferralProfileForClient(client.id)
}

export async function trackReferralClick(
  req: NextRequest,
  res: NextResponse,
  rawCode: string | null,
  landingPath?: string
): Promise<{ ok: true; code: string } | { ok: false; error: string; status: number }> {
  const code = normalizeReferralCode(rawCode)
  if (!code) return { ok: false, error: 'Invalid referral code.', status: 400 }
  const profile = await getReferralProfileByCode(code)
  if (!profile || profile.status !== 'active') {
    return { ok: false, error: 'This referral link is not active.', status: 404 }
  }

  const attributionId = createHash('sha256')
    .update(`${profile.id}:${Date.now()}:${Math.random()}`)
    .digest('hex')
    .slice(0, 24)
  await insertReferralClick({
    referral_profile_id: profile.id,
    attribution_id: attributionId,
    landing_path: landingPath || req.nextUrl.pathname,
    ip_hash: hashIp(getClientIp(req)),
    user_agent: (req.headers.get('user-agent') || '').slice(0, 180) || null,
  })
  await insertReferralEvent({
    referral_profile_id: profile.id,
    event_type: 'link_clicked',
    detail: landingPath || '/credit-funding',
  })
  setReferralAttributionCookie(res, {
    code: profile.referral_code,
    profileId: profile.id,
    issuedAt: Date.now(),
  })
  return { ok: true, code: profile.referral_code }
}

export async function attachReferralToApplication(params: {
  req: NextRequest
  application: { id: string; email?: string | null; client_id?: string | null; status?: string | null }
}): Promise<void> {
  const existing = await getReferralByApplicationId(params.application.id)
  if (existing) {
    if (params.application.client_id && !existing.referred_client_id) {
      await updateReferral(existing.id, { referred_client_id: params.application.client_id })
    }
    return
  }

  const attribution = readReferralAttributionFromRequest(params.req)
  if (!attribution) return
  const profile = await getReferralProfileByCode(attribution.code)
  if (!profile || profile.id !== attribution.profileId || profile.status !== 'active') return

  const referrer = await getClientById(profile.client_id)
  const applicantEmail = params.application.email?.trim().toLowerCase()
  if (referrer && applicantEmail && referrer.email?.trim().toLowerCase() === applicantEmail) {
    await insertReferralEvent({
      referral_profile_id: profile.id,
      event_type: 'self_referral_blocked',
      detail: params.application.id,
    })
    return
  }

  const referral = await insertReferral({
    referral_profile_id: profile.id,
    referred_application_id: params.application.id,
    referred_client_id: params.application.client_id || null,
    referral_status: 'submitted',
    application_submitted_at: new Date().toISOString(),
  })
  if (!referral) return

  const { getSupabase } = await import('@/lib/supabase')
  await getSupabase()
    .from('credit_funding_applications')
    .update({ referral_id: referral.id, updated_at: new Date().toISOString() })
    .eq('id', params.application.id)

  await insertReferralEvent({
    referral_id: referral.id,
    referral_profile_id: profile.id,
    event_type: 'application_submitted',
    detail: params.application.id,
  })

  const referrerUser = await getUserForClient(profile.client_id, referrer?.email)
  if (referrerUser) {
    await createNotification({
      user_id: referrerUser.id,
      title: 'New referral application',
      message: 'Someone used your referral link and submitted a credit repair application.',
      type: 'info',
      link: '/dashboard/referrals',
    })
    const referrerClient = referrer || (await getClientById(profile.client_id))
    if (referrerClient?.email) {
      sendHtmlMailNonBlocking({
        to: referrerClient.email,
        subject: 'Someone used your Sunday Harmony referral link',
        html: clientDashboardAlertEmailHtml({
          heading: 'New referral application',
          firstName: referrerClient.name.split(/\s+/)[0] || 'there',
          bodyParagraphs: [
            'Someone used your referral link and submitted a credit repair application.',
            'You earn $50 when they complete their credit repair payment.',
          ],
          dashboardPath: '/dashboard/referrals',
          buttonLabel: 'View referrals',
        }),
        logLabel: 'referral-application',
      })
    }
  }
}

export async function markReferralAcceptedForApplication(applicationId: string): Promise<void> {
  const referral = await getReferralByApplicationId(applicationId)
  if (!referral) return
  if (referral.referral_status === 'paid' || referral.referral_status === 'cancelled') return
  await updateReferral(referral.id, { referral_status: 'accepted' })
  await insertReferralEvent({
    referral_id: referral.id,
    referral_profile_id: referral.referral_profile_id,
    event_type: 'application_accepted',
    detail: applicationId,
  })
}

export async function syncReferralFromApplicationStatus(
  applicationId: string,
  status: string
): Promise<void> {
  try {
    if (status === 'approved' || status === 'completed') {
      await markReferralAcceptedForApplication(applicationId)
      return
    }
    if (status !== 'declined' && status !== 'archived') return
    const referral = await getReferralByApplicationId(applicationId)
    if (!referral) return
    if (referral.referral_status === 'paid' || referral.referral_status === 'cancelled') return
    await updateReferral(referral.id, { referral_status: 'cancelled' })
    await insertReferralEvent({
      referral_id: referral.id,
      referral_profile_id: referral.referral_profile_id,
      event_type: 'referral_cancelled',
      detail: status,
    })
  } catch (err) {
    console.error('syncReferralFromApplicationStatus failed:', err)
  }
}

export async function getReferralSummaryForApplication(applicationId: string) {
  const referral = await getReferralByApplicationId(applicationId)
  if (!referral) return null
  const profile = await getReferralProfileById(referral.referral_profile_id)
  const referrer = profile ? await getClientById(profile.client_id) : null
  return {
    referralId: referral.id,
    code: profile?.referral_code || null,
    referrerName: referrer?.name || 'Referring client',
    referrerClientId: profile?.client_id || null,
    status: referral.referral_status,
  }
}

export async function refreshConnectStatus(clientId: string): Promise<void> {
  const profile = await getReferralProfileByClientId(clientId)
  if (profile?.stripe_connect_account_id) {
    await syncConnectAccount(profile.stripe_connect_account_id)
  }
}

export async function awardReferralCommissionForPaidClient(
  clientId: string,
  input: { qualifyingPaymentId: string; paidAt: string }
): Promise<void> {
  if (!input.qualifyingPaymentId?.trim()) return
  const existingPayment = await getCommissionByPaymentId(input.qualifyingPaymentId)
  if (existingPayment) return

  const paidClient = await getClientById(clientId)
  if (!paidClient) return
  const qualifying = isQualifyingRepairPayment({
    billingModel: paidClient.billing_model,
    invoiceBillingModel: 'credit_repair_one_time',
    hasSubscription: Boolean(paidClient.stripe_subscription_id?.trim()),
  })

  const byClient = await getReferralsByReferredClientId(clientId)
  const app = await getCreditFundingApplicationByClientId(clientId).catch(() => undefined)
  const byApps: ReferralRow[] = []
  if (app) {
    const row = await getReferralByApplicationId(app.id)
    if (row) byApps.push(row)
  }
  const referral = byClient[0] || byApps[0]
  if (!referral) return

  if (referral.referred_client_id !== clientId) {
    await updateReferral(referral.id, { referred_client_id: clientId })
  }

  const profileRow = await getReferralProfileById(referral.referral_profile_id)
  if (!profileRow) return

  const referrer = await getClientById(profileRow.client_id)
  const isSelf =
    Boolean(referrer && paidClient.email && referrer.email?.trim().toLowerCase() === paidClient.email.trim().toLowerCase()) ||
    profileRow.client_id === clientId

  const existingForClient = await getActiveCommissionForReferredClient(clientId)
  if (
    !shouldCreateCommission({
      alreadyHasCommission: Boolean(existingForClient),
      referrerDisabled: profileRow.status !== 'active',
      isSelfReferral: isSelf,
      isQualifyingPayment: qualifying,
    })
  ) {
    return
  }

  const holdDays = referralHoldDays()
  const availableAt = new Date(Date.parse(input.paidAt) + holdDays * 24 * 60 * 60 * 1000).toISOString()
  const status = nextCommissionStatusAfterHold(availableAt)
  const commission = await insertCommission({
    referral_id: referral.id,
    referred_client_id: clientId,
    qualifying_payment_id: input.qualifyingPaymentId,
    amount_cents: referralCommissionCents(),
    status,
    available_at: availableAt,
  })
  if (!commission) return

  await updateReferral(referral.id, {
    referral_status: 'paid',
    qualifying_payment_at: input.paidAt,
    referred_client_id: clientId,
  })
  await insertReferralEvent({
    referral_id: referral.id,
    referral_profile_id: profileRow.id,
    event_type: 'commission_earned',
    detail: formatCommissionCents(commission.amount_cents),
  })
  if (status === 'available') {
    await insertReferralEvent({
      referral_id: referral.id,
      referral_profile_id: profileRow.id,
      event_type: 'commission_available',
      detail: commission.id,
    })
  }

  const referrerUser = await getUserForClient(profileRow.client_id, referrer?.email)
  const amountLabel = formatCommissionCents(commission.amount_cents)
  if (referrerUser) {
    await createNotification({
      user_id: referrerUser.id,
      title: 'Referral commission earned',
      message: `You earned a ${amountLabel} referral commission.`,
      type: 'billing',
      link: '/dashboard/referrals',
    })
    if (status === 'available') {
      await createNotification({
        user_id: referrerUser.id,
        title: 'Commission available',
        message: `Your ${amountLabel} referral commission is now available for payout.`,
        type: 'billing',
        link: '/dashboard/referrals',
      })
    }
  }
  if (referrer?.email) {
    sendHtmlMailNonBlocking({
      to: referrer.email,
      subject: `You earned a ${amountLabel} referral commission`,
      html: clientDashboardAlertEmailHtml({
        heading: 'Referral commission earned',
        firstName: referrer.name.split(/\s+/)[0] || 'there',
        bodyParagraphs: [
          `You earned a ${amountLabel} referral commission because someone you referred completed their credit repair payment.`,
          status === 'available'
            ? 'This amount is available for payout.'
            : 'It will become available for payout after the hold period.',
        ],
        dashboardPath: '/dashboard/referrals',
        buttonLabel: 'View referrals',
      }),
      logLabel: 'referral-commission',
    })
  }
}

function summarizeCommissions(rows: ReferralCommissionRow[]) {
  const now = Date.now()
  let earned = 0
  let paid = 0
  let pending = 0
  let processing = 0
  let available = 0
  for (const c of rows) {
    if (c.status === 'cancelled' || c.status === 'revoked') continue
    earned += c.amount_cents
    if (c.status === 'paid') paid += c.amount_cents
    else if (c.status === 'processing') processing += c.amount_cents
    else if (c.status === 'available' || (c.status === 'pending' && Date.parse(c.available_at) <= now)) {
      available += c.amount_cents
    } else if (c.status === 'pending') {
      pending += c.amount_cents
    }
  }
  return { earned, paid, pending, processing, available }
}

async function dashboardRowsForProfile(profile: ReferralProfileRow, privacy: boolean) {
  const referrals = await listReferralsForProfile(profile.id)
  const commissions = await listCommissionsForReferrals(referrals.map(r => r.id))
  const commissionByReferral = new Map(commissions.map(c => [c.referral_id, c]))
  const clicks = await countReferralClicks(profile.id)

  const list = []
  for (const referral of referrals) {
    let applicantName = 'Applicant'
    let applicationStatus: string = referral.referral_status
    let applicationId: string | null = null
    let applicationUuid: string | null = privacy ? null : referral.referred_application_id
    if (referral.referred_application_id) {
      const app = await getCreditFundingApplicationById(referral.referred_application_id)
      if (app) {
        applicantName = privacy ? maskApplicantName(app.full_name) : app.full_name
        applicationStatus = app.status
        applicationId = privacy ? null : app.application_id
        applicationUuid = privacy ? null : app.id
      }
    }
    const commission = commissionByReferral.get(referral.id)
    const paid = Boolean(commission) || referral.referral_status === 'paid'
    list.push({
      id: referral.id,
      commissionId: commission?.id || null,
      date: referral.application_submitted_at || referral.attributed_at,
      applicant: applicantName,
      applicationStatus,
      applicationId,
      applicationUuid,
      payment: paid ? 'paid' : 'unpaid',
      commissionCents: commission && !['cancelled', 'revoked'].includes(commission.status) ? commission.amount_cents : 0,
      commissionStatus: commission?.status || 'not_eligible',
    })
  }

  const totals = summarizeCommissions(commissions)
  const submitted = referrals.length
  const paidApplicants = list.filter(r => r.payment === 'paid').length
  return {
    profile: {
      code: profile.referral_code,
      link: publicReferralUrl(profile.referral_code),
      status: profile.status,
      payoutReady: profile.payout_ready,
      hasConnectAccount: Boolean(profile.stripe_connect_account_id),
    },
    summary: {
      clicks,
      submitted,
      paidApplicants,
      earnedCents: totals.earned,
      paidCents: totals.paid,
      pendingCents: totals.pending + totals.processing,
      availableCents: totals.available,
    },
    referrals: list,
    payouts: (await listPayoutsForClient(profile.client_id)).map(p => ({
      id: p.id,
      date: p.requested_at,
      amountCents: p.amount_cents,
      status: p.status,
      paymentReference: p.provider_transaction_id,
      provider: p.payment_provider,
      failureReason: p.failure_reason,
    })),
  }
}

export async function getClientReferralDashboard(clientId: string) {
  const profile = await ensureReferralProfileForClient(clientId)
  if (!profile) {
    return { error: 'Referrals are only available for credit repair clients.', status: 403 as const }
  }
  return dashboardRowsForProfile(profile, true)
}

export async function getAdminReferralOverview() {
  const profiles = await listAllReferralProfiles()
  const clicks = await countClicksAll()
  let submitted = 0
  let paidApplicants = 0
  let earned = 0
  let paid = 0
  let outstanding = 0
  let pendingPayouts = 0
  const clients = []

  for (const profile of profiles) {
    const client = await getClientById(profile.client_id)
    const dash = await dashboardRowsForProfile(profile, false)
    submitted += dash.summary.submitted
    paidApplicants += dash.summary.paidApplicants
    earned += dash.summary.earnedCents
    paid += dash.summary.paidCents
    outstanding += dash.summary.availableCents + dash.summary.pendingCents
    pendingPayouts += dash.payouts.filter(p => p.status === 'processing' || p.status === 'requested').length
    clients.push({
      clientId: profile.client_id,
      name: client?.name || 'Client',
      email: client?.email || '',
      code: profile.referral_code,
      status: profile.status,
      payoutReady: profile.payout_ready,
      ...dash.summary,
    })
  }

  return {
    overview: {
      referralClients: profiles.length,
      clicks,
      submitted,
      paidApplicants,
      earnedCents: earned,
      paidCents: paid,
      outstandingCents: outstanding,
      pendingPayouts,
    },
    clients,
  }
}

export async function getAdminPayouts() {
  const payouts = await listAllPayouts()
  const rows = []
  for (const payout of payouts) {
    const client = await getClientById(payout.client_id)
    rows.push({
      id: payout.id,
      date: payout.requested_at,
      amountCents: payout.amount_cents,
      status: payout.status,
      paymentReference: payout.provider_transaction_id,
      provider: payout.payment_provider,
      failureReason: payout.failure_reason,
      clientId: payout.client_id,
      clientName: client?.name || 'Client',
      clientEmail: client?.email || '',
    })
  }
  return rows
}

export async function getAdminReferralClient(clientId: string) {
  const profile = await ensureReferralProfileForClient(clientId)
  if (!profile) return { error: 'No referral profile for this client.', status: 404 as const }
  const client = await getClientById(clientId)
  const dash = await dashboardRowsForProfile(profile, false)
  const events = await listReferralEvents(profile.id)
  return {
    client: client
      ? { id: client.id, name: client.name, email: client.email, billing_status: client.billing_status }
      : null,
    ...dash,
    events: events.map(e => ({
      id: e.id,
      referralId: e.referral_id,
      type: e.event_type,
      detail: e.detail,
      createdAt: e.created_at,
    })),
  }
}

export async function adminSetReferralEnabled(clientId: string, enabled: boolean, actorEmail: string) {
  const profile = await ensureReferralProfileForClient(clientId)
  if (!profile) return { error: 'No referral profile for this client.', status: 404 as const }
  const updated = await updateReferralProfile(profile.id, { status: enabled ? 'active' : 'disabled' })
  await logActivity({
    action: 'updated',
    entity_type: 'client',
    entity_id: clientId,
    actor_email: actorEmail,
    details: enabled ? 'Enabled referral participation' : 'Disabled referral participation',
  })
  return { ok: true as const, profile: updated }
}

export async function adminRegenerateReferralCode(clientId: string, actorEmail: string) {
  const profile = await ensureReferralProfileForClient(clientId)
  if (!profile) return { error: 'No referral profile for this client.', status: 404 as const }
  let updated = null
  for (let i = 0; i < 6; i++) {
    const code = generateReferralCode(n => randomBytes(n))
    updated = await updateReferralProfile(profile.id, { referral_code: code })
    if (updated) break
  }
  await logActivity({
    action: 'updated',
    entity_type: 'client',
    entity_id: clientId,
    actor_email: actorEmail,
    details: `Regenerated referral code to ${updated?.referral_code || 'new code'}`,
  })
  return { ok: true as const, profile: updated }
}

export async function adminAdjustCommission(params: {
  commissionId: string
  status: CommissionStatus
  reason: string
  actorEmail: string
  clientId: string
}) {
  const reason = params.reason.trim()
  if (!reason) return { error: 'A reason is required for commission adjustments.', status: 400 as const }
  const existing = await getCommissionById(params.commissionId)
  if (!existing) return { error: 'Commission not found.', status: 404 as const }
  await updateCommission(params.commissionId, {
    status: params.status,
    cancelled_reason: ['cancelled', 'revoked'].includes(params.status) ? reason : null,
  })
  const profile = await getReferralProfileByClientId(params.clientId)
  if (profile) {
    await insertReferralEvent({
      referral_id: existing.referral_id,
      referral_profile_id: profile.id,
      event_type: 'commission_adjusted',
      detail: `${params.status}: ${reason}`,
    })
  }
  await logActivity({
    action: 'updated',
    entity_type: 'client',
    entity_id: params.clientId,
    actor_email: params.actorEmail,
    details: `Referral commission ${params.commissionId} set to ${params.status}: ${reason}`,
  })
  return { ok: true as const }
}

export async function createConnectOnboardingLink(clientId: string): Promise<
  { url: string } | { error: string; status: number }
> {
  const profile = await ensureReferralProfileForClient(clientId)
  if (!profile) return { error: 'Referrals are only available for credit repair clients.', status: 403 }
  const client = await getClientById(clientId)
  if (!client?.email) return { error: 'Client email is required to set up payouts.', status: 400 }

  const stripe = getStripe()
  let accountId = profile.stripe_connect_account_id
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: client.email,
      metadata: { client_id: clientId, referral_profile_id: profile.id },
      capabilities: { transfers: { requested: true } },
    })
    accountId = account.id
    await updateReferralProfile(profile.id, { stripe_connect_account_id: accountId })
  }

  const origin = getPublicSiteUrl()
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/dashboard/referrals?connect=refresh`,
    return_url: `${origin}/dashboard/referrals?connect=return`,
    type: 'account_onboarding',
  })
  if (!link.url) return { error: 'Could not start payout onboarding.', status: 500 }
  return { url: link.url }
}

export async function syncConnectAccount(accountId: string): Promise<void> {
  const { data } = await (await import('@/lib/supabase')).getSupabase()
    .from('referral_profiles')
    .select('*')
    .eq('stripe_connect_account_id', accountId)
    .maybeSingle()
  const profile = data as ReferralProfileRow | null
  if (!profile) return
  const account = await getStripe().accounts.retrieve(accountId)
  const ready = Boolean(account.payouts_enabled && account.details_submitted)
  await updateReferralProfile(profile.id, { payout_ready: ready })
}

export async function initiateReferralPayout(params: {
  clientId: string
  actorEmail: string
  provider?: 'stripe' | 'manual'
  amountCents?: number
  manualReference?: string
}): Promise<{ ok: true; payoutId: string } | { error: string; status: number }> {
  const profile = await ensureReferralProfileForClient(params.clientId)
  if (!profile) return { error: 'No referral profile for this client.', status: 404 }

  const available = await listAvailableCommissions(profile.id)
  const total = available.reduce((sum, c) => sum + c.amount_cents, 0)
  const amount = params.amountCents && params.amountCents > 0 ? params.amountCents : total
  if (amount < 1) return { error: 'No available commission balance to pay.', status: 400 }
  if (amount > total) return { error: 'Payout amount exceeds available balance.', status: 400 }

  let remaining = amount
  const selected: ReferralCommissionRow[] = []
  for (const row of available) {
    if (remaining <= 0) break
    selected.push(row)
    remaining -= row.amount_cents
  }
  if (remaining > 0) return { error: 'Could not match commissions to the payout amount.', status: 400 }

  const provider = params.provider || (profile.stripe_connect_account_id && profile.payout_ready ? 'stripe' : 'manual')
  const payout = await insertPayout({
    client_id: params.clientId,
    referral_profile_id: profile.id,
    amount_cents: amount,
    payment_provider: provider,
    status: 'processing',
    initiated_by_email: params.actorEmail,
    provider_transaction_id: provider === 'manual' ? params.manualReference?.trim() || null : null,
  })
  if (!payout) return { error: 'Could not create payout record.', status: 500 }

  for (const row of selected) {
    await updateCommission(row.id, { status: 'processing', payout_id: payout.id })
  }

  if (provider === 'manual') {
    await completePayoutSuccess(payout.id, params.manualReference?.trim() || payout.id)
    return { ok: true, payoutId: payout.id }
  }

  if (!profile.stripe_connect_account_id) {
    await failPayout(payout.id, 'Referring client has not connected a payout account.')
    return { error: 'Client has not connected a payout method. Use a manual payout or ask them to set up payouts.', status: 400 }
  }

  try {
    const transfer = await getStripe().transfers.create({
      amount,
      currency: 'usd',
      destination: profile.stripe_connect_account_id,
      metadata: {
        referral_payout_id: payout.id,
        client_id: params.clientId,
      },
    })
    await updatePayout(payout.id, { provider_transaction_id: transfer.id })
    await completePayoutSuccess(payout.id, transfer.id)
    return { ok: true, payoutId: payout.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe transfer failed'
    await failPayout(payout.id, message)
    return { error: message, status: 502 }
  }
}

export async function completePayoutSuccess(payoutId: string, providerId?: string): Promise<void> {
  const payout = await updatePayout(payoutId, {
    status: 'paid',
    processed_at: new Date().toISOString(),
    provider_transaction_id: providerId,
  })
  if (!payout) return
  const commissions = await listCommissionsByPayoutId(payoutId)
  const paidAt = new Date().toISOString()
  for (const row of commissions) {
    await updateCommission(row.id, { status: 'paid', paid_at: paidAt, payout_id: payoutId })
  }
  const client = await getClientById(payout.client_id)
  const referrerUser = await getUserForClient(payout.client_id, client?.email)
  if (referrerUser) {
    await createNotification({
      user_id: referrerUser.id,
      title: 'Referral payout sent',
      message: `Your ${formatCommissionCents(payout.amount_cents)} referral commission payment has been sent.`,
      type: 'billing',
      link: '/dashboard/referrals',
    })
  }
  if (client?.email) {
    sendHtmlMailNonBlocking({
      to: client.email,
      subject: 'Your referral commission payment has been sent',
      html: clientDashboardAlertEmailHtml({
        heading: 'Payout sent',
        firstName: client.name.split(/\s+/)[0] || 'there',
        bodyParagraphs: [
          `Your ${formatCommissionCents(payout.amount_cents)} referral commission payment has been sent.`,
        ],
        dashboardPath: '/dashboard/referrals',
        buttonLabel: 'View payout history',
      }),
      logLabel: 'referral-payout',
    })
  }
}

export async function failPayout(payoutId: string, reason: string): Promise<void> {
  await updatePayout(payoutId, {
    status: 'failed',
    failed_at: new Date().toISOString(),
    failure_reason: reason,
  })
  const commissions = await listCommissionsByPayoutId(payoutId)
  for (const row of commissions) {
    await updateCommission(row.id, { status: 'available', payout_id: null })
  }
}

export async function handleStripePayoutEvent(eventType: string, object: { id?: string; metadata?: Record<string, string> | null }): Promise<void> {
  if (eventType === 'account.updated' && object.id) {
    await syncConnectAccount(object.id)
    return
  }
  if (!eventType.startsWith('transfer.')) return
  const payoutId = object.metadata?.referral_payout_id
  const payout = payoutId
    ? await getPayoutById(payoutId)
    : object.id
      ? await getPayoutByProviderId(object.id)
      : null
  if (!payout) return
  if (eventType === 'transfer.failed' || eventType === 'transfer.reversed') {
    if (payout.status !== 'failed') await failPayout(payout.id, eventType)
    return
  }
  if (eventType === 'transfer.created' || eventType === 'transfer.updated' || eventType === 'transfer.paid') {
    if (payout.status !== 'paid') await completePayoutSuccess(payout.id, object.id)
  }
}
